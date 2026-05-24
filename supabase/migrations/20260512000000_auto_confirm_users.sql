-- Auto-confirm new users by setting confirmation timestamps.
-- This ensures users can log in immediately without email verification.

-- Drop any previous versions of this trigger
DROP TRIGGER IF EXISTS a_trig_auto_confirm_user ON auth.users;
DROP TRIGGER IF EXISTS trig_auto_confirm_user ON auth.users;

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- We set both email_confirmed_at and confirmed_at for maximum compatibility.
  -- These fields exist in the auth.users table.
  BEGIN
    NEW.email_confirmed_at = now();
    NEW.confirmed_at = now();

    -- Ensure the user is marked as having the 'email' provider in app metadata.
    -- This helps the Auth UI and other logic know the user is properly setup.
    NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- If anything goes wrong, we still want to allow the user creation to proceed.
    -- Supabase Auth will then follow its default flow (sending an email).
    RAISE WARNING 'auto_confirm_user failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Using a BEFORE INSERT trigger to modify the user record before it hits the database.
CREATE TRIGGER a_trig_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();
