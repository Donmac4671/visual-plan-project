
-- 1. Add reseller_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reseller_id uuid;
CREATE INDEX IF NOT EXISTS idx_profiles_reseller_id ON public.profiles(reseller_id);

-- 2. Reseller code assignments (sequential R001, R002, ...)
CREATE TABLE IF NOT EXISTS public.reseller_code_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reseller_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reseller_code_assignments TO authenticated;
GRANT ALL ON public.reseller_code_assignments TO service_role;
ALTER TABLE public.reseller_code_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view reseller assignments" ON public.reseller_code_assignments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own reseller assignment" ON public.reseller_code_assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Reseller custom prices
CREATE TABLE IF NOT EXISTS public.reseller_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL,
  network_id text NOT NULL,
  bundle_size text NOT NULL,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, network_id, bundle_size)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_prices TO authenticated;
GRANT ALL ON public.reseller_prices TO service_role;
ALTER TABLE public.reseller_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access reseller_prices" ON public.reseller_prices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Reseller manage own prices" ON public.reseller_prices
  FOR ALL TO authenticated
  USING (reseller_id = auth.uid())
  WITH CHECK (reseller_id = auth.uid());

CREATE POLICY "Customer can view own reseller prices" ON public.reseller_prices
  FOR SELECT TO authenticated
  USING (reseller_id = (SELECT p.reseller_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE TRIGGER update_reseller_prices_updated_at
  BEFORE UPDATE ON public.reseller_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Update admin_set_user_tier to allow 'reseller' and assign R-code
CREATE OR REPLACE FUNCTION public.admin_set_user_tier(target_user_id uuid, new_tier text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_code TEXT;
  new_num INT;
  new_code TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF new_tier NOT IN ('general', 'agent', 'reseller') THEN
    RAISE EXCEPTION 'Invalid tier: %', new_tier;
  END IF;

  IF new_tier = 'agent' THEN
    SELECT agent_code INTO existing_code FROM public.agent_code_assignments WHERE user_id = target_user_id;
    IF existing_code IS NULL THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(agent_code FROM 'Agent (\d+)') AS INT)), 0) + 1
        INTO new_num FROM public.agent_code_assignments;
      new_code := 'Agent ' || lpad(new_num::text, 3, '0');
      INSERT INTO public.agent_code_assignments (user_id, agent_code) VALUES (target_user_id, new_code);
    ELSE
      new_code := existing_code;
    END IF;
    UPDATE public.profiles SET tier = 'agent', agent_code = new_code WHERE user_id = target_user_id;
  ELSIF new_tier = 'reseller' THEN
    SELECT reseller_code INTO existing_code FROM public.reseller_code_assignments WHERE user_id = target_user_id;
    IF existing_code IS NULL THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(reseller_code FROM 'R(\d+)') AS INT)), 0) + 1
        INTO new_num FROM public.reseller_code_assignments;
      new_code := 'R' || lpad(new_num::text, 3, '0');
      INSERT INTO public.reseller_code_assignments (user_id, reseller_code) VALUES (target_user_id, new_code);
    ELSE
      new_code := existing_code;
    END IF;
    UPDATE public.profiles SET tier = 'reseller', agent_code = new_code WHERE user_id = target_user_id;
  ELSE
    UPDATE public.profiles SET tier = 'general', agent_code = '' WHERE user_id = target_user_id;
  END IF;
END;
$function$;

-- 5. bind_reseller RPC — link a customer to a reseller via their R-code
CREATE OR REPLACE FUNCTION public.bind_reseller(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_reseller_id uuid;
  v_existing uuid;
BEGIN
  IF v_user_id IS NULL THEN RETURN false; END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RETURN false; END IF;

  SELECT reseller_id INTO v_existing FROM public.profiles WHERE user_id = v_user_id;
  IF v_existing IS NOT NULL THEN RETURN false; END IF;

  -- Find reseller by their assigned R-code OR agent_code on profile
  SELECT p.user_id INTO v_reseller_id
  FROM public.profiles p
  WHERE upper(p.agent_code) = upper(trim(p_code))
    AND p.tier = 'reseller'
  LIMIT 1;

  IF v_reseller_id IS NULL OR v_reseller_id = v_user_id THEN RETURN false; END IF;

  UPDATE public.profiles SET reseller_id = v_reseller_id WHERE user_id = v_user_id;
  RETURN true;
END;
$function$;

-- 6. Update protect_profile_fields to also lock reseller_id
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
  NEW.reseller_id           := OLD.reseller_id;
  RETURN NEW;
END;
$function$;
