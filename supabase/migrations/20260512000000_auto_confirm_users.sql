-- Consolidated and hardened user registration setup.
-- This ensures auto-confirmation and handles profile creation without ever blocking signup.

-- 1. Clean up ALL previous triggers to avoid conflicts
DROP TRIGGER IF EXISTS a_trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Define the auto-confirm function (BEFORE INSERT)
-- Modifying NEW is the safest and most efficient way to handle auto-confirm.
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Mark user as confirmed immediately
  NEW.email_confirmed_at = now();
  NEW.confirmed_at = now();

  -- Set app metadata to satisfy Auth logic
  NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fallback: log and allow insert to proceed
  RAISE WARNING 'auto_confirm_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Define the resilient profile creation function (AFTER INSERT)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We isolate secondary tasks in an exception block.
  -- Registration (auth.users) will NEVER fail because of this.
  BEGIN
    -- Create the public profile
    INSERT INTO public.profiles (user_id, full_name, email, phone, agent_code, tier)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      '',
      'general'
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Auto-assign admin if email matches
    IF NEW.email = 'donmacdatahub@gmail.com' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Log setup failures but allow registration to complete
    RAISE WARNING 'Registration setup failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4. Re-create the triggers
CREATE TRIGGER a_trig_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Helper RPC for reliable phone uniqueness checks
CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE phone = p_phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_phone_exists(text) TO anon, authenticated, service_role;
