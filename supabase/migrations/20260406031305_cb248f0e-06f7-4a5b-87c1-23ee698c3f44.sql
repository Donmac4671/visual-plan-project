
-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update pay_with_wallet to set pending after 10 PM UTC
CREATE OR REPLACE FUNCTION public.pay_with_wallet(p_network text, p_phone text, p_bundle text, p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC;
  new_order_id UUID;
  order_count INT;
  new_ref TEXT;
  current_hour INT;
  order_status TEXT;
BEGIN
  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id = auth.uid();

  SELECT COUNT(*) + 1 INTO order_count FROM public.orders;
  new_ref := 'DMH' || lpad(order_count::text, 3, '0');

  -- Check current hour in UTC (Ghana time = UTC)
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

-- Update pay_order_with_paystack to set pending after 10 PM UTC
CREATE OR REPLACE FUNCTION public.pay_order_with_paystack(p_network text, p_phone text, p_bundle text, p_amount numeric, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_order_id UUID;
  order_count INT;
  new_ref TEXT;
  current_hour INT;
  order_status TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO order_count FROM public.orders;
  new_ref := 'DMH' || lpad(order_count::text, 3, '0');

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

-- Create function to process pending orders (called by cron at 5 AM)
CREATE OR REPLACE FUNCTION public.process_pending_orders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.orders SET status = 'processing' WHERE status = 'pending';
END;
$function$;
