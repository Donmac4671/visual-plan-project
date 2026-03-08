
CREATE OR REPLACE FUNCTION public.complete_paystack_topup(p_amount numeric, p_reference text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier TEXT;
  min_amount NUMERIC;
BEGIN
  SELECT tier INTO user_tier FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_tier = 'agent' THEN
    min_amount := 20;
  ELSE
    min_amount := 5;
  END IF;

  IF p_amount < min_amount THEN
    RAISE EXCEPTION 'Minimum top-up amount is % cedis for your account type', min_amount;
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE user_id = auth.uid();
  
  INSERT INTO public.wallet_topups (user_id, amount, method, status, paystack_reference)
  VALUES (auth.uid(), p_amount, 'paystack', 'completed', p_reference);
  
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'topup', 'Wallet Top-up via Paystack', p_amount, 'completed');
END;
$function$;
