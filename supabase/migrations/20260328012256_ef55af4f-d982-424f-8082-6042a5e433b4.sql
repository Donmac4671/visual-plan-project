
-- Custom bundles for admin CRUD (add/edit packages)
CREATE TABLE public.custom_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id text NOT NULL,
  bundle_size text NOT NULL,
  size_gb numeric NOT NULL,
  agent_price numeric NOT NULL,
  general_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(network_id, bundle_size)
);

ALTER TABLE public.custom_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view custom bundles" ON public.custom_bundles FOR SELECT USING (true);
CREATE POLICY "Admin can insert custom bundles" ON public.custom_bundles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update custom bundles" ON public.custom_bundles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete custom bundles" ON public.custom_bundles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Verified topups for transaction ID claim system
CREATE TABLE public.verified_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  network text NOT NULL,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_by uuid,
  claimed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.verified_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view verified topups" ON public.verified_topups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert verified topups" ON public.verified_topups FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update verified topups" ON public.verified_topups FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete verified topups" ON public.verified_topups FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Claim function for users
CREATE OR REPLACE FUNCTION public.claim_verified_topup(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_topup RECORD;
BEGIN
  SELECT * INTO v_topup FROM public.verified_topups WHERE transaction_id = p_transaction_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction ID not found. Please check and try again.';
  END IF;
  
  IF v_topup.is_claimed THEN
    RAISE EXCEPTION 'This transaction has already been claimed.';
  END IF;
  
  UPDATE public.verified_topups 
  SET is_claimed = true, claimed_by = auth.uid(), claimed_at = now() 
  WHERE id = v_topup.id;
  
  UPDATE public.profiles SET wallet_balance = wallet_balance + v_topup.amount WHERE user_id = auth.uid();
  
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'topup', 'MoMo top-up claimed (' || v_topup.network || ' ID: ' || p_transaction_id || ')', v_topup.amount, 'completed');
  
  INSERT INTO public.wallet_topups (user_id, amount, method, status, paystack_reference)
  VALUES (auth.uid(), v_topup.amount, 'momo', 'completed', p_transaction_id);
END;
$$;

-- Admin role management function
CREATE OR REPLACE FUNCTION public.admin_toggle_admin_role(target_user_id uuid, make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  IF make_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'admin';
  END IF;
END;
$$;

-- Allow admin to view all user roles
CREATE POLICY "Admin can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
