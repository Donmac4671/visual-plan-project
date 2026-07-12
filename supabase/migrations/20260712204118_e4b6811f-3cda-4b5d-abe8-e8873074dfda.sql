
-- 1) Revoke execute from client roles on sensitive RPCs
REVOKE EXECUTE ON FUNCTION public.api_place_wallet_order(uuid, text, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.api_place_wallet_order(uuid, text, text, text, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.auto_claim_topup_by_reference(text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.auto_claim_topup_by_reference(text, text, numeric, text) TO service_role;

-- 2) Server-side price validator. Returns TRUE if amount matches the authoritative
--    price for (network, bundle) taking tier and reseller overrides into account.
--    Returns TRUE when no authoritative price is on file (mashup/airtime/vs style
--    products where the amount IS the package the user selected).
CREATE OR REPLACE FUNCTION public.validate_bundle_amount(
  p_user_id uuid,
  p_network text,
  p_bundle  text,
  p_amount  numeric
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_reseller uuid;
  v_norm text := lower(trim(coalesce(p_network,'')));
  v_norm2 text := replace(lower(trim(coalesce(p_network,''))), ' ', '-');
  v_agent numeric;
  v_general numeric;
  v_expected numeric;
  v_reseller_price numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN false;
  END IF;

  SELECT tier, reseller_id INTO v_tier, v_reseller
    FROM public.profiles WHERE user_id = p_user_id;

  SELECT agent_price, general_price
    INTO v_agent, v_general
    FROM public.custom_bundles
   WHERE (lower(network_id) = v_norm OR lower(network_id) = v_norm2)
     AND bundle_size = p_bundle
   LIMIT 1;

  -- No authoritative record => user-priced product (airtime/mashup/vs). Allow.
  IF v_agent IS NULL AND v_general IS NULL THEN
    RETURN true;
  END IF;

  -- Reseller-linked customers pay the reseller's set price if one exists
  IF v_reseller IS NOT NULL THEN
    SELECT price INTO v_reseller_price
      FROM public.reseller_prices
     WHERE reseller_id = v_reseller
       AND (lower(network_id) = v_norm OR lower(network_id) = v_norm2)
       AND bundle_size = p_bundle
     LIMIT 1;
    IF v_reseller_price IS NOT NULL THEN
      RETURN abs(p_amount - v_reseller_price) < 0.01;
    END IF;
  END IF;

  v_expected := CASE WHEN v_tier IN ('agent','reseller') THEN coalesce(v_agent, v_general)
                     ELSE coalesce(v_general, v_agent) END;

  RETURN abs(p_amount - v_expected) < 0.01;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_bundle_amount(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_bundle_amount(uuid, text, text, numeric) TO authenticated, service_role;

-- 3) Enforce validation inside the three order-placing RPCs
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
  v_blocked boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  IF NOT public.validate_bundle_amount(auth.uid(), p_network, p_bundle, p_amount) THEN
    RAISE EXCEPTION 'Price mismatch for % %. Please refresh your cart and try again.', p_network, p_bundle;
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
$function$;

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

  IF NOT public.validate_bundle_amount(p_user, p_network, p_bundle, p_amount) THEN
    RAISE EXCEPTION 'Price mismatch for % %.', p_network, p_bundle;
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
$function$;

CREATE OR REPLACE FUNCTION public.pay_order_with_paystack_for_user(p_user_id uuid, p_network text, p_phone text, p_bundle text, p_amount numeric, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_order_id UUID;
  new_ref TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  IF NOT public.validate_bundle_amount(p_user_id, p_network, p_bundle, p_amount) THEN
    RAISE EXCEPTION 'Price mismatch for % %.', p_network, p_bundle;
  END IF;

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
$function$;
