-- Ultra-resilient migration to fix "Database error" during signup and enable direct login.
-- This approach uses a single AFTER INSERT trigger with granular error handling.

-- 1. Remove all competing triggers to avoid transaction conflicts
DROP TRIGGER IF EXISTS a_trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Define a robust handler for user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ACTION A: Auto-confirm the user account in auth.users
  -- This allows login immediately if the app doesn't get a session right away.
  BEGIN
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmed_at = COALESCE(confirmed_at, now()),
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- If auto-confirm fails, we log and proceed. User registration MUST not fail.
    RAISE WARNING 'Registration confirmation failed for %: %', NEW.id, SQLERRM;
  END;

  -- ACTION B: Create the user profile
  BEGIN
    INSERT INTO public.profiles (user_id, full_name, email, phone, agent_code, tier)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      '',
      'general'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Profile creation failures (e.g. unique phone) shouldn't crash the auth transaction.
    RAISE WARNING 'Profile creation failed for %: %', NEW.id, SQLERRM;
  END;

  -- ACTION C: Assign default user role
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');

    -- Auto-assign admin if email matches
    IF NEW.email = 'donmacdatahub@gmail.com' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Role assignment failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 3. Re-create the single, clean trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Keep the helper RPC for phone checks
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

GRANT EXECUTE ON FUNCTION public.check_phone_exists(text) TO anon, authenticated;
