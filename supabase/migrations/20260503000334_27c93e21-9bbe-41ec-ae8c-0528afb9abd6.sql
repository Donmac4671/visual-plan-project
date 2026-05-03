-- Add topup_reference_code to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS topup_reference_code text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_topup_reference_code_unique
  ON public.profiles (topup_reference_code)
  WHERE topup_reference_code <> '';

-- Protect topup_reference_code from direct user updates (only via RPC)
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'postgres' OR session_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.wallet_balance        := OLD.wallet_balance;
  NEW.tier                  := OLD.tier;
  NEW.agent_code            := OLD.agent_code;
  NEW.is_blocked            := OLD.is_blocked;
  NEW.referral_code         := OLD.referral_code;
  NEW.topup_reference_code  := OLD.topup_reference_code;
  NEW.user_id               := OLD.user_id;
  NEW.id                    := OLD.id;
  NEW.created_at            := OLD.created_at;

  RETURN NEW;
END;
$function$;

-- RPC to generate / regenerate a 6-char A-Z0-9 reference code for the calling user
CREATE OR REPLACE FUNCTION public.generate_topup_reference_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempts int := 0;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;

    BEGIN
      UPDATE public.profiles
        SET topup_reference_code = v_code
        WHERE user_id = v_user_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts > 20 THEN
        RAISE EXCEPTION 'Could not generate unique code, please retry';
      END IF;
    END;
  END LOOP;

  RETURN v_code;
END;
$$;

-- RPC for the SMS webhook (service role) to claim a verified topup directly to a user
CREATE OR REPLACE FUNCTION public.auto_claim_topup_by_reference(
  p_reference_code text,
  p_transaction_id text,
  p_amount numeric,
  p_network text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_topup_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE topup_reference_code = upper(trim(p_reference_code))
    AND topup_reference_code <> ''
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Skip if this transaction id already exists in verified_topups
  IF EXISTS (SELECT 1 FROM public.verified_topups WHERE transaction_id = p_transaction_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.verified_topups (transaction_id, amount, network, is_claimed, claimed_by, claimed_at)
  VALUES (p_transaction_id, p_amount, p_network, true, v_user_id, now())
  RETURNING id INTO v_topup_id;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance + p_amount
    WHERE user_id = v_user_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (
    v_user_id,
    'topup',
    'MoMo top-up auto-claimed via reference code (' || p_network || ' ID: ' || p_transaction_id || ')',
    p_amount,
    'completed'
  );

  INSERT INTO public.wallet_topups (user_id, amount, method, status, paystack_reference)
  VALUES (v_user_id, p_amount, 'momo', 'completed', p_transaction_id);

  RETURN v_topup_id;
END;
$$;