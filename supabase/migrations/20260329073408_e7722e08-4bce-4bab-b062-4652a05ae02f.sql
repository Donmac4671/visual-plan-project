
-- Update process_referral_reward: only handles ₵0.50 user referral on first purchase
CREATE OR REPLACE FUNCTION public.process_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referral RECORD;
  v_referred_tier TEXT;
BEGIN
  IF NEW.status NOT IN ('processing', 'completed') THEN RETURN NEW; END IF;

  SELECT * INTO v_referral FROM public.referrals WHERE referred_id = NEW.user_id AND reward_paid = false;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Only reward on first order
  IF (SELECT COUNT(*) FROM public.orders WHERE user_id = NEW.user_id) > 1 THEN RETURN NEW; END IF;

  SELECT tier INTO v_referred_tier FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- If already an agent, the agent reward trigger handles it; only pay ₵0.50 for general users
  IF v_referred_tier = 'agent' THEN RETURN NEW; END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance + 0.50 WHERE user_id = v_referral.referrer_id;
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (v_referral.referrer_id, 'credit', 'Referral reward - new user made first purchase', 0.50, 'completed');
  UPDATE public.referrals SET reward_paid = true, reward_amount = 0.50 WHERE id = v_referral.id;

  RETURN NEW;
END;
$function$;

-- New function: reward ₵10 when referred user becomes an agent
CREATE OR REPLACE FUNCTION public.process_agent_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referral RECORD;
BEGIN
  -- Only trigger when tier changes to 'agent'
  IF NEW.tier IS DISTINCT FROM 'agent' OR OLD.tier = 'agent' THEN RETURN NEW; END IF;

  SELECT * INTO v_referral FROM public.referrals WHERE referred_id = NEW.user_id AND reward_paid = false;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance + 10.00 WHERE user_id = v_referral.referrer_id;
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (v_referral.referrer_id, 'credit', 'Referral reward - referred user became an agent', 10.00, 'completed');
  UPDATE public.referrals SET reward_paid = true, reward_amount = 10.00 WHERE id = v_referral.id;

  RETURN NEW;
END;
$function$;

-- Create trigger for agent tier upgrade
CREATE TRIGGER trigger_agent_referral_reward
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.process_agent_referral_reward();
