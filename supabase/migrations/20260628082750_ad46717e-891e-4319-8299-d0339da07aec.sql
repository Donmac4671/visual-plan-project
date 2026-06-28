
-- 1) Auto-refund trigger when an order transitions to 'failed'
CREATE OR REPLACE FUNCTION public.auto_refund_on_failed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    PERFORM public.refund_failed_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_refund_on_failed ON public.orders;
CREATE TRIGGER trg_auto_refund_on_failed
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_refund_on_failed();

-- 2) Allow authenticated users to read ALL public visibility toggles
DROP POLICY IF EXISTS "Authenticated can view public toggles" ON public.app_settings;
CREATE POLICY "Authenticated can view public toggles"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (key = ANY (ARRAY[
    'mashup_enabled','airtime_enabled','vs_enabled',
    'mashup_data_enabled','mtn_enabled','telecel_enabled',
    'at_premium_enabled','at_bigtime_enabled'
  ]));

-- 3) Enforce block on wallet purchases server-side
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

  SELECT is_blocked INTO v_blocked FROM public.profiles WHERE user_id = auth.uid();
  IF v_blocked THEN
    RAISE EXCEPTION 'Your account is blocked. Please contact support.';
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
