-- Auto-confirm new users by setting email_confirmed_at on insertion.
-- This ensures users can log in immediately without email verification.

-- Drop the old trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS trig_auto_confirm_user ON auth.users;

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- We set both email_confirmed_at and confirmed_at for maximum compatibility
  -- with different Supabase Auth versions/configurations.
  NEW.email_confirmed_at = now();
  NEW.confirmed_at = now();

  -- Also ensure the user is marked as having the 'email' provider in app metadata
  NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb;

  RETURN NEW;
END;
$$;

-- Using a BEFORE INSERT trigger to modify the user record before it hits the database
CREATE TRIGGER trig_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();
