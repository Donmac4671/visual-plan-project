
-- 1) Replace count-based order refs with unique timestamp-based refs in pay_with_wallet
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

  -- Unique ref: timestamp + random suffix
  new_ref := 'DMH' || LPAD(EXTRACT(EPOCH FROM now())::bigint % 1000000 || '', 6, '0') || LPAD(floor(random() * 100)::int::text, 2, '0');

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

-- 2) Replace count-based order refs in pay_order_with_paystack
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
  -- Unique ref: timestamp + random suffix
  new_ref := 'DMH' || LPAD(EXTRACT(EPOCH FROM now())::bigint % 1000000 || '', 6, '0') || LPAD(floor(random() * 100)::int::text, 2, '0');

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

-- 3) Attach missing triggers for referral system
-- Generate referral code on new profile
DROP TRIGGER IF EXISTS trg_generate_referral_code ON public.profiles;
CREATE TRIGGER trg_generate_referral_code
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Reward referrer when referred user's first order is placed
DROP TRIGGER IF EXISTS trg_process_referral_reward ON public.orders;
CREATE TRIGGER trg_process_referral_reward
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_reward();

-- Reward referrer when referred user becomes an agent
DROP TRIGGER IF EXISTS trg_process_agent_referral_reward ON public.profiles;
CREATE TRIGGER trg_process_agent_referral_reward
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.process_agent_referral_reward();
