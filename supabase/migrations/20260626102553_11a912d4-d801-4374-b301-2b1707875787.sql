
-- 1. Hard safety net: wallet can never go below zero at the database level
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_wallet_balance_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_wallet_balance_nonneg CHECK (wallet_balance >= 0);

-- 2. Atomic wallet debit for in-app orders
CREATE OR REPLACE FUNCTION public.pay_with_wallet(p_network text, p_phone text, p_bundle text, p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows int;
  new_order_id UUID;
  new_ref TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Atomic: only debit if balance is sufficient. Two concurrent calls cannot both succeed.
  UPDATE public.profiles
     SET wallet_balance = wallet_balance - p_amount
   WHERE user_id = auth.uid()
     AND wallet_balance >= p_amount;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  new_ref := public.next_order_ref();

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'wallet')
  RETURNING id INTO new_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone, -p_amount, 'completed');

  RETURN new_order_id;
END;
$function$;

-- 3. Same atomic debit for API-initiated wallet orders
CREATE OR REPLACE FUNCTION public.api_place_wallet_order(p_user uuid, p_network text, p_phone text, p_bundle text, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows int;
  v_order_id uuid;
  v_ref text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  UPDATE public.profiles
     SET wallet_balance = wallet_balance - p_amount
   WHERE user_id = p_user
     AND wallet_balance >= p_amount;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Distinguish missing user vs insufficient funds
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user) THEN
      RAISE EXCEPTION 'User not found';
    END IF;
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  v_ref := public.next_order_ref();

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (p_user, v_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'wallet')
  RETURNING id INTO v_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (p_user, 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone || ' (API)', -p_amount, 'completed');

  RETURN jsonb_build_object('id', v_order_id, 'order_ref', v_ref, 'status', 'processing');
END;
$function$;
