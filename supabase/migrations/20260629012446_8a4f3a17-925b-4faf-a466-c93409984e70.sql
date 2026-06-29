
-- Drop duplicate referral trigger to avoid redundant work
DROP TRIGGER IF EXISTS trigger_process_referral_reward ON public.orders;

-- Helper: is this network/product currently enabled by admin?
CREATE OR REPLACE FUNCTION public.is_network_enabled(p_network text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_val jsonb;
  v_norm text := upper(coalesce(p_network,''));
BEGIN
  v_key := CASE
    WHEN v_norm = 'MTN' THEN 'mtn_enabled'
    WHEN v_norm = 'TELECEL' THEN 'telecel_enabled'
    WHEN v_norm = 'AT PREMIUM' THEN 'at_premium_enabled'
    WHEN v_norm = 'AT BIG TIME' THEN 'at_bigtime_enabled'
    WHEN v_norm = 'AIRTIME' THEN 'airtime_enabled'
    WHEN v_norm = 'MASHUP' THEN 'mashup_enabled'
    WHEN v_norm LIKE 'TELECEL V%' THEN 'vs_enabled'
    WHEN v_norm = 'MTN MASHUP DATA' THEN 'mashup_data_enabled'
    WHEN v_norm = 'MTN MASHUP MINUTES + DATA' THEN 'mashup_data_enabled'
    ELSE NULL
  END;
  IF v_key IS NULL THEN RETURN true; END IF;
  SELECT value INTO v_val FROM public.app_settings WHERE key = v_key;
  IF v_val IS NULL OR v_val = 'null'::jsonb THEN RETURN true; END IF;
  RETURN (v_val::text) NOT IN ('false','"false"');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_network_enabled(text) TO authenticated, service_role;

-- Helper: is this specific bundle hidden by admin?
CREATE OR REPLACE FUNCTION public.is_bundle_hidden(p_network_id text, p_bundle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hidden_bundles
    WHERE lower(network_id) = lower(coalesce(p_network_id,''))
      AND bundle_size = p_bundle
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_bundle_hidden(text, text) TO authenticated, service_role;

-- Enforce network-level toggle inside wallet RPC
CREATE OR REPLACE FUNCTION public.pay_with_wallet(p_network text, p_phone text, p_bundle text, p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
  new_order_id UUID;
  new_ref TEXT;
  v_blocked boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT is_blocked INTO v_blocked FROM public.profiles WHERE user_id = auth.uid();
  IF v_blocked THEN
    RAISE EXCEPTION 'Your account is blocked. Please contact support.';
  END IF;

  IF NOT public.is_network_enabled(p_network) THEN
    RAISE EXCEPTION '% is currently offline. Please try again later.', p_network;
  END IF;

  IF public.is_bundle_hidden(p_network, p_bundle) THEN
    RAISE EXCEPTION '% % is currently offline. Please remove it from your cart.', p_network, p_bundle;
  END IF;

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
$$;

-- Enforce network-level toggle inside paystack RPC too
CREATE OR REPLACE FUNCTION public.pay_order_with_paystack_for_user(p_user_id uuid, p_network text, p_phone text, p_bundle text, p_amount numeric, p_reference text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_order_id UUID;
  new_ref TEXT;
BEGIN
  IF NOT public.is_network_enabled(p_network) THEN
    RAISE EXCEPTION '% is currently offline. Please try again later.', p_network;
  END IF;
  IF public.is_bundle_hidden(p_network, p_bundle) THEN
    RAISE EXCEPTION '% % is currently offline. Please remove it from your cart.', p_network, p_bundle;
  END IF;
  new_ref := public.next_order_ref();
  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (p_user_id, new_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'paystack')
  RETURNING id INTO new_order_id;
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (p_user_id, 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone || ' (Paystack)', -p_amount, 'completed');
  RETURN new_order_id;
END;
$$;

-- And in the API path
CREATE OR REPLACE FUNCTION public.api_place_wallet_order(p_user uuid, p_network text, p_phone text, p_bundle text, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
  v_order_id uuid;
  v_ref text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  IF NOT public.is_network_enabled(p_network) THEN
    RAISE EXCEPTION '% is currently offline. Please try again later.', p_network;
  END IF;
  IF public.is_bundle_hidden(p_network, p_bundle) THEN
    RAISE EXCEPTION '% % is currently offline.', p_network, p_bundle;
  END IF;

  UPDATE public.profiles
     SET wallet_balance = wallet_balance - p_amount
   WHERE user_id = p_user
     AND wallet_balance >= p_amount;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
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
$$;
