-- Auto-confirm new users by setting email_confirmed_at on insertion.
-- This ensures users can log in immediately without email verification.

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$;

-- Trigger must be BEFORE INSERT to modify the NEW record in auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trig_auto_confirm_user'
  ) THEN
    CREATE TRIGGER trig_auto_confirm_user
      BEFORE INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.auto_confirm_user();
  END IF;
END $$;
