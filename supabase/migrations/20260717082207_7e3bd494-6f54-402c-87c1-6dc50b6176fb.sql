CREATE OR REPLACE FUNCTION public.validate_bundle_amount(p_user_id uuid, p_network text, p_bundle text, p_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text;
  v_reseller uuid;
  v_norm text := lower(trim(coalesce(p_network,'')));
  v_norm2 text := replace(lower(trim(coalesce(p_network,''))), ' ', '-');
  v_agent numeric;
  v_general numeric;
  v_expected numeric;
  v_reseller_price numeric;
  v_promo_disc numeric;
  v_discounted numeric;
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

  IF abs(p_amount - v_expected) < 0.01 THEN
    RETURN true;
  END IF;

  -- Accept prices discounted by any active promotion applicable to this user's audience.
  FOR v_promo_disc IN
    SELECT discount_percent
      FROM public.promotions
     WHERE is_active = true
       AND starts_at <= now()
       AND expires_at >= now()
       AND (
         target_audience = 'everyone'
         OR (target_audience = 'agent' AND v_tier = 'agent')
         OR (target_audience = 'general' AND coalesce(v_tier,'general') <> 'agent')
       )
  LOOP
    v_discounted := round((v_expected * (1 - v_promo_disc / 100))::numeric, 2);
    IF abs(p_amount - v_discounted) < 0.01 THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$function$;