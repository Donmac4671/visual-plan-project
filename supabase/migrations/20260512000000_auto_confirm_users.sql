-- Definitive fix for auto-confirmation and registration "Database error".
-- This migration uses separate triggers for safety and isolation.

-- 1. Clean up ALL previous versions of these triggers to avoid duplication or conflicts
DROP TRIGGER IF EXISTS a_trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Define the auto-confirmation function (Runs BEFORE INSERT on auth.users)
-- This is the safest way to modify the user record without internal UPDATE conflicts.
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Set confirmation fields directly on the NEW record
  NEW.email_confirmed_at = now();
  NEW.confirmed_at = now();

  -- Ensure app metadata indicates the provider is setup
  NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Even if this fails, we must return NEW to allow registration to proceed
  RAISE WARNING 'auto_confirm_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Define the resilient profile creation function (Runs AFTER INSERT on auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We isolate ALL profile-related work in an exception block.
  -- Registration (the primary auth.users insert) will NEVER fail because of this.
  BEGIN
    -- Create the profile
    INSERT INTO public.profiles (user_id, full_name, email, phone, agent_code, tier)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      '',
      'general'
    );

    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');

    -- Auto-assign admin role for the admin email
    IF NEW.email = 'donmacdatahub@gmail.com' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Log the error but allow the trigger to finish successfully.
    -- If a profile is missing, admins can re-run the sync logic manually.
    RAISE WARNING 'handle_new_user failed to create profile/roles for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4. Re-create the triggers with clear separation
-- a_ prefix ensures it runs first among triggers of the same timing, though timing differs here.
CREATE TRIGGER a_trig_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Keep the phone check RPC for frontend validation
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
