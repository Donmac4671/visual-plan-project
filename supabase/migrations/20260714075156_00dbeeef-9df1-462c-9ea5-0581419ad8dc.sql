
CREATE OR REPLACE FUNCTION public.refund_failed_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Only refund wallet payments
  IF v_order.payment_method <> 'wallet' THEN RETURN; END IF;

  -- Only refund when the order is actually failed
  IF v_order.status <> 'failed' THEN RETURN; END IF;

  -- Never refund twice
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = v_order.user_id
      AND type = 'refund'
      AND description LIKE '%' || v_order.order_ref || '%'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_order.amount
    WHERE user_id = v_order.user_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (
    v_order.user_id,
    'refund',
    'Refund for failed order ' || v_order.order_ref || ' (' || v_order.network || ' ' || v_order.bundle_size || ')',
    v_order.amount,
    'completed'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.refund_failed_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_failed_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_failed_order(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_failed_order(uuid) TO service_role;
