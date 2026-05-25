-- Consolidated migration to auto-confirm users and harden profile creation.
-- This ensures users can log in immediately and prevents profile errors from blocking signups.

-- 1. Clean up ALL existing triggers on auth.users to ensure a clean slate
DROP TRIGGER IF EXISTS a_trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Define the auto-confirm function (Runs BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  BEGIN
    NEW.email_confirmed_at = now();
    NEW.confirmed_at = now();
    -- Ensure the user has the email provider metadata set
    NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: log and let auth handle it normally if the modification fails
    RAISE WARNING 'auto_confirm_user failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 3. Define the hardened profile creation function (Runs AFTER INSERT)
-- This replaces the original handle_new_user to include error isolation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We wrap the entire logic in an exception block so that if profile creation fails
  -- (e.g. because of a duplicate phone number that bypassed the frontend check),
  -- the user is still created in auth.users and registration doesn't crash.
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

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

    -- Preserve existing admin assignment logic
    IF NEW.email = 'donmacdatahub@gmail.com' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but allow the transaction to complete.
    -- The user will exist but might need manual profile fixing by admin.
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4. Re-create the triggers
-- We use alphabetical naming to control order if needed, but BEFORE vs AFTER is key here.
CREATE TRIGGER a_trig_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Provide an RPC for reliable phone uniqueness checks that bypasses RLS
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
