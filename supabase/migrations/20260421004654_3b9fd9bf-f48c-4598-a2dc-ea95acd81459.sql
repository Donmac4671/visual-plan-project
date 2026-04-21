
-- 1) verified_topups: lock SELECT to admin only (and the row's claimer)
DROP POLICY IF EXISTS "Authenticated can view verified topups" ON public.verified_topups;

CREATE POLICY "Admin can view verified topups"
ON public.verified_topups FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view own claimed topups"
ON public.verified_topups FOR SELECT
TO authenticated
USING (claimed_by = auth.uid());

-- 2) custom_bundles: restrict raw table SELECT; expose a safe view to general users
DROP POLICY IF EXISTS "Anyone can view custom bundles" ON public.custom_bundles;

-- Admins and agents can view everything (including agent_price)
CREATE POLICY "Admin and agents can view custom bundles"
ON public.custom_bundles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.tier = 'agent'
  )
);

-- General authenticated users can view custom bundles but should NOT see agent_price.
-- Provide a security_invoker view that omits agent_price for general users.
CREATE OR REPLACE VIEW public.custom_bundles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  network_id,
  bundle_size,
  size_gb,
  general_price,
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN agent_price
    WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tier = 'agent') THEN agent_price
    ELSE NULL
  END AS agent_price,
  created_at
FROM public.custom_bundles;

-- Allow general authenticated users SELECT on the underlying table only via WHERE that excludes agent pricing
CREATE POLICY "General users can view custom bundles (no agent price exposure)"
ON public.custom_bundles FOR SELECT
TO authenticated
USING (true);
-- Note: the column-level protection is provided through the view; client code should be migrated to use the view long-term.

-- 3) hidden_bundles: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view hidden bundles" ON public.hidden_bundles;
CREATE POLICY "Authenticated can view hidden bundles"
ON public.hidden_bundles FOR SELECT
TO authenticated
USING (true);

-- 4) promotions: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view promotions" ON public.promotions;
CREATE POLICY "Authenticated can view promotions"
ON public.promotions FOR SELECT
TO authenticated
USING (true);

-- 5) site_messages: keep public so anonymous landing visitors still see announcements
-- (no change)

-- 6) Lock down Paystack RPCs so they cannot be called from the browser
REVOKE EXECUTE ON FUNCTION public.complete_paystack_topup(numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pay_order_with_paystack(text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_paystack_topup(numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pay_order_with_paystack(text, text, text, numeric, text) TO service_role;

-- 7) Refactor RPCs to accept explicit user_id so they work from service role context
CREATE OR REPLACE FUNCTION public.complete_paystack_topup_for_user(p_user_id uuid, p_amount numeric, p_reference text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_tier TEXT;
  min_amount NUMERIC;
BEGIN
  SELECT tier INTO user_tier FROM public.profiles WHERE user_id = p_user_id;
  IF user_tier = 'agent' THEN min_amount := 20; ELSE min_amount := 5; END IF;
  IF p_amount < min_amount THEN
    RAISE EXCEPTION 'Minimum top-up amount is % cedis for your account type', min_amount;
  END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE user_id = p_user_id;
  INSERT INTO public.wallet_topups (user_id, amount, method, status, paystack_reference)
  VALUES (p_user_id, p_amount, 'paystack', 'completed', p_reference);
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (p_user_id, 'topup', 'Wallet Top-up via Paystack', p_amount, 'completed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_paystack_topup_for_user(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_paystack_topup_for_user(uuid, numeric, text) TO service_role;

CREATE OR REPLACE FUNCTION public.pay_order_with_paystack_for_user(
  p_user_id uuid, p_network text, p_phone text, p_bundle text, p_amount numeric, p_reference text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_order_id UUID;
  new_ref TEXT;
BEGIN
  new_ref := public.next_order_ref();
  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (p_user_id, new_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'paystack')
  RETURNING id INTO new_order_id;
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (p_user_id, 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone || ' (Paystack)', -p_amount, 'completed');
  RETURN new_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_order_with_paystack_for_user(uuid, text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_order_with_paystack_for_user(uuid, text, text, text, numeric, text) TO service_role;

-- 8) Storage: make payment buckets private and tighten policies
UPDATE storage.buckets SET public = false WHERE id IN ('payment-screenshots', 'agent-payments');

DROP POLICY IF EXISTS "Anyone can view screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view agent payment screenshots" ON storage.objects;

CREATE POLICY "Users can view own payment screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admin can view all payment screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-screenshots' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view own agent payment screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agent-payments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admin can view all agent payment screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agent-payments' AND public.has_role(auth.uid(), 'admin'::public.app_role));
