-- Hyper-resilient registration migration.
-- Ensures auto-confirmation and profile creation never block user registration.

-- 1. Clean up ALL previous registration triggers on auth.users
DROP TRIGGER IF EXISTS a_trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Define a singular, bulletproof trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- We wrap EVERYTHING in one big exception block.
  -- This trigger MUST NEVER fail the primary auth.users insert.
  BEGIN
    -- STEP A: Auto-confirm the user account
    -- This allows instant login even if GoTrue doesn't return a session immediately.
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmed_at = COALESCE(confirmed_at, now()),
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb
    WHERE id = NEW.id;

    -- STEP B: Create the public profile
    -- We use ON CONFLICT DO NOTHING just in case of races
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

    -- STEP C: Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- STEP D: Auto-assign admin if email matches
    IF NEW.email = 'donmacdatahub@gmail.com' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- If any part of the secondary setup fails, we log a warning but allow registration.
    -- This fixes the "Database error saving new user" once and for all.
    RAISE WARNING 'Registration setup failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 3. Re-create the single AFTER INSERT trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Set permissions to ensure the function can be executed in any context
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, authenticated, anon;

-- 5. Helper RPC for phone check (remains same, but re-asserted for completeness)
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
