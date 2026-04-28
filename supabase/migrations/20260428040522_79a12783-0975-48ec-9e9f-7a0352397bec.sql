-- 1. Trigger-based protection on profiles to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admin self-updates: lock protected fields to their previous values
  NEW.wallet_balance := OLD.wallet_balance;
  NEW.tier           := OLD.tier;
  NEW.agent_code     := OLD.agent_code;
  NEW.is_blocked     := OLD.is_blocked;
  NEW.referral_code  := OLD.referral_code;
  NEW.user_id        := OLD.user_id;
  NEW.id             := OLD.id;
  NEW.created_at     := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields();

-- 2. Restrict site_messages public reads to active rows only
DROP POLICY IF EXISTS "Anyone can view active messages" ON public.site_messages;

CREATE POLICY "Anyone can view active messages"
ON public.site_messages
FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admin can view all messages"
ON public.site_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));