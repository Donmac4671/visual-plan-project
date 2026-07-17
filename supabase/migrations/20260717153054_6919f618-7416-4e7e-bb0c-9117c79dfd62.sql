
-- Block registrations that impersonate admin, and prevent non-admins from granting admin role.

CREATE OR REPLACE FUNCTION public.block_admin_impersonation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := coalesce(NEW.raw_user_meta_data->>'full_name', '');
  v_email text := coalesce(NEW.email, '');
BEGIN
  -- Allow the designated owner email through
  IF lower(v_email) = 'donmacdatahub@gmail.com' THEN
    RETURN NEW;
  END IF;

  IF v_name ~* '(^|[^a-z])admin([^a-z]|$)' OR v_name ~* 'admin' THEN
    RAISE EXCEPTION 'This name is not allowed for registration.' USING ERRCODE = 'check_violation';
  END IF;

  IF v_email ~* 'admin' THEN
    RAISE EXCEPTION 'This email address is not allowed for registration.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_admin_impersonation_trg ON auth.users;
CREATE TRIGGER block_admin_impersonation_trg
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.block_admin_impersonation();

-- Guard user_roles: only admins (or the owner-email bootstrap in handle_new_user via SECURITY DEFINER)
-- can insert an 'admin' role. Non-admin self-inserts of 'admin' are rejected.
CREATE OR REPLACE FUNCTION public.guard_admin_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner_email text;
BEGIN
  IF NEW.role <> 'admin' THEN
    RETURN NEW;
  END IF;

  -- Allow when there is no auth context (SECURITY DEFINER bootstrap paths like handle_new_user)
  IF v_caller IS NULL THEN
    -- Only allow bootstrap admin for the designated owner email
    SELECT email INTO v_owner_email FROM auth.users WHERE id = NEW.user_id;
    IF lower(coalesce(v_owner_email,'')) = 'donmacdatahub@gmail.com' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Admin role can only be granted by an existing admin.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF public.has_role(v_caller, 'admin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Admin role can only be granted by an existing admin.' USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS guard_admin_role_assignment_trg ON public.user_roles;
CREATE TRIGGER guard_admin_role_assignment_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_assignment();
