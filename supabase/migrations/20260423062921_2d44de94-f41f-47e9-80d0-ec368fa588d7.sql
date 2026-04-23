
-- Prevent new registrations from reusing an existing phone number
CREATE OR REPLACE FUNCTION public.prevent_duplicate_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phone IS NULL OR length(trim(NEW.phone)) = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.phone = OLD.phone THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone = NEW.phone
      AND user_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'This phone number is already registered to another account.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_duplicate_phone ON public.profiles;
CREATE TRIGGER profiles_prevent_duplicate_phone
BEFORE INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_phone();
