CREATE SEQUENCE IF NOT EXISTS public.order_ref_seq START WITH 572 INCREMENT BY 1;

SELECT setval(
  'public.order_ref_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX((substring(order_ref FROM 4))::bigint)
        FROM public.orders
        WHERE order_ref ~ '^DMH[0-9]{1,4}$'
      ),
      0
    ),
    571
  ),
  true
);

CREATE OR REPLACE FUNCTION public.next_order_ref()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number bigint;
BEGIN
  next_number := nextval('public.order_ref_seq');
  RETURN 'DMH' || next_number::text;
END;
$function$;

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
  current_hour INT;
  order_status TEXT;
BEGIN
  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id = auth.uid();

  new_ref := public.next_order_ref();

  current_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC');
  IF current_hour >= 22 OR current_hour < 5 THEN
    order_status := 'pending';
  ELSE
    order_status := 'processing';
  END IF;

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, order_status, 'wallet')
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
  current_hour INT;
  order_status TEXT;
BEGIN
  new_ref := public.next_order_ref();

  current_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC');
  IF current_hour >= 22 OR current_hour < 5 THEN
    order_status := 'pending';
  ELSE
    order_status := 'processing';
  END IF;

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, order_status, 'paystack')
  RETURNING id INTO new_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone || ' (Paystack)', -p_amount, 'completed');

  RETURN new_order_id;
END;
$function$;