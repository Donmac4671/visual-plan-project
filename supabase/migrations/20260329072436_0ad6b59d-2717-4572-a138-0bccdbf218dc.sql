
-- Referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0.50,
  reward_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

-- Add referral_code column to profiles
ALTER TABLE public.profiles ADD COLUMN referral_code TEXT NOT NULL DEFAULT '';

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (referrer_id = auth.uid());

CREATE POLICY "Admin can view all referrals" ON public.referrals
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Generate referral code on new profile
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles SET referral_code = 'DMH' || UPPER(SUBSTR(MD5(NEW.user_id::text || NOW()::text), 1, 6)) WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_referral_code
  AFTER INSERT ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Process referral reward on first purchase
CREATE OR REPLACE FUNCTION public.process_referral_reward()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_referral RECORD;
  v_referred_tier TEXT;
  v_reward NUMERIC;
BEGIN
  IF NEW.status NOT IN ('processing', 'completed') THEN RETURN NEW; END IF;

  SELECT * INTO v_referral FROM public.referrals WHERE referred_id = NEW.user_id AND reward_paid = false;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF (SELECT COUNT(*) FROM public.orders WHERE user_id = NEW.user_id) > 1 THEN RETURN NEW; END IF;

  SELECT tier INTO v_referred_tier FROM public.profiles WHERE user_id = NEW.user_id;
  v_reward := CASE WHEN v_referred_tier = 'agent' THEN 10.00 ELSE 0.50 END;

  UPDATE public.profiles SET wallet_balance = wallet_balance + v_reward WHERE user_id = v_referral.referrer_id;
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (v_referral.referrer_id, 'credit', 'Referral reward for inviting a new ' || v_referred_tier || ' user', v_reward, 'completed');
  UPDATE public.referrals SET reward_paid = true, reward_amount = v_reward WHERE id = v_referral.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_process_referral_reward
  AFTER INSERT ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_reward();

-- Generate referral codes for existing users
UPDATE public.profiles SET referral_code = 'DMH' || UPPER(SUBSTR(MD5(user_id::text || created_at::text), 1, 6)) WHERE referral_code = '';
