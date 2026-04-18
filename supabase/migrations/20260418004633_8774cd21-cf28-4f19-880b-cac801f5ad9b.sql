-- 24/7 delivery: orders no longer queue between 10pm-5am, they go straight to processing.
-- Also allow 'waiting' as a valid status (used when GHDataConnect reports the order is waiting).
CREATE OR REPLACE FUNCTION public.pay_with_wallet(p_network text, p_phone text, p_bundle text, p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC;
  new_order_id UUID;
  new_ref TEXT;
BEGIN
  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id = auth.uid();

  new_ref := public.next_order_ref();

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'wallet')
  RETURNING id INTO new_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone, -p_amount, 'completed');

  RETURN new_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pay_order_with_paystack(p_network text, p_phone text, p_bundle text, p_amount numeric, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_order_id UUID;
  new_ref TEXT;
BEGIN
  new_ref := public.next_order_ref();

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'paystack')
  RETURNING id INTO new_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone || ' (Paystack)', -p_amount, 'completed');

  RETURN new_order_id;
END;
$function$;

-- Allow admin to set 'waiting' as a valid status as well
CREATE OR REPLACE FUNCTION public.admin_update_order_status(order_id uuid, new_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF new_status NOT IN ('pending', 'processing', 'waiting', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE public.orders SET status = new_status WHERE id = order_id;
END;
$function$;

-- Move any existing 'pending' orders to 'processing' (24/7 delivery is now on)
UPDATE public.orders SET status = 'processing' WHERE status = 'pending';