
CREATE OR REPLACE FUNCTION public.admin_wallet_operation(target_user_id uuid, operation_amount numeric, operation_type text, operation_description text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  IF operation_type = 'credit' THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + operation_amount WHERE user_id = target_user_id;
    INSERT INTO public.transactions (user_id, type, description, amount, status)
    VALUES (target_user_id, 'credit', operation_description, operation_amount, 'completed');
  ELSIF operation_type = 'debit' THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance - operation_amount WHERE user_id = target_user_id;
    INSERT INTO public.transactions (user_id, type, description, amount, status)
    VALUES (target_user_id, 'debit', operation_description, -operation_amount, 'completed');
  ELSE
    RAISE EXCEPTION 'Invalid operation type';
  END IF;
END;
$function$;
