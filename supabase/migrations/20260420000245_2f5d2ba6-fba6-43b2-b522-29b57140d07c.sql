DO $$
DECLARE
  uids uuid[] := ARRAY['15218053-af53-4884-9ff0-ba71b2aee1c0'::uuid, 'dd028f03-f712-4d08-bad1-4cb2502fac28'::uuid];
BEGIN
  DELETE FROM public.chat_messages WHERE user_id = ANY(uids);
  DELETE FROM public.complaints WHERE user_id = ANY(uids);
  DELETE FROM public.agent_applications WHERE user_id = ANY(uids);
  DELETE FROM public.push_subscriptions WHERE user_id = ANY(uids);
  DELETE FROM public.referrals WHERE referrer_id = ANY(uids) OR referred_id = ANY(uids);
  DELETE FROM public.transactions WHERE user_id = ANY(uids);
  DELETE FROM public.wallet_topups WHERE user_id = ANY(uids);
  DELETE FROM public.verified_topups WHERE claimed_by = ANY(uids);
  DELETE FROM public.orders WHERE user_id = ANY(uids);
  DELETE FROM public.user_roles WHERE user_id = ANY(uids);
  DELETE FROM public.profiles WHERE user_id = ANY(uids);
  DELETE FROM auth.users WHERE id = ANY(uids);
END $$;