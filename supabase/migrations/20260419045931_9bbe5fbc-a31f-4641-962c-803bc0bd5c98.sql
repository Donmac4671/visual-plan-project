-- Allows new users to create their referral row even though they can't SELECT
-- another user's profile (RLS blocks it). Validates referrer exists by code.
CREATE OR REPLACE FUNCTION public.register_referral(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN;
  END IF;

  -- Already has a referral? Skip silently
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_user_id) THEN
    RETURN;
  END IF;

  SELECT user_id INTO v_referrer_id
  FROM public.profiles
  WHERE upper(referral_code) = upper(trim(p_code))
  LIMIT 1;

  IF v_referrer_id IS NULL OR v_referrer_id = v_user_id THEN
    RETURN;
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, referral_code)
  VALUES (v_referrer_id, v_user_id, upper(trim(p_code)));
END;
$$;