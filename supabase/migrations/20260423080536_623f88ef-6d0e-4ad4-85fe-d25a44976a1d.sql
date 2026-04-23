DO $$
DECLARE
  v_user_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_user_ids
  FROM auth.users
  WHERE email IN ('kwarkoaab@gmail.com','benita7kwarkoaa@icloud.com');

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RAISE NOTICE 'No matching users found';
    RETURN;
  END IF;

  DELETE FROM public.chat_messages WHERE user_id = ANY(v_user_ids);
  DELETE FROM public.push_subscriptions WHERE user_id = ANY(v_user_ids);
  DELETE FROM public.complaints WHERE user_id = ANY(v_user_ids);
  DELETE FROM public.wallet_topups WHERE user_id = ANY(v_user_ids);
  DELETE FROM public.transactions WHERE user_id = ANY(v_user_ids);
  DELETE FROM public.orders WHERE user_id = ANY(v_user_ids);
  DELETE FROM public.agent_applications WHERE user_id = ANY(v_user_ids);
  DELETE FROM public.agent_code_assignments WHERE user_id = ANY(v_user_ids);
  DELETE FROM public.referrals WHERE referrer_id = ANY(v_user_ids) OR referred_id = ANY(v_user_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(v_user_ids);
  UPDATE public.verified_topups SET claimed_by = NULL, is_claimed = false, claimed_at = NULL WHERE claimed_by = ANY(v_user_ids);
  DELETE FROM public.profiles WHERE user_id = ANY(v_user_ids);
  DELETE FROM auth.users WHERE id = ANY(v_user_ids);
END $$;