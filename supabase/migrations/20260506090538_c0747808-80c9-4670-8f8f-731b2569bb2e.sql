CREATE OR REPLACE FUNCTION public.admin_set_auto_deliver_minutes(p_minutes integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_minutes IS NOT NULL AND p_minutes NOT IN (5,10,15,20,30,45,60) THEN
    RAISE EXCEPTION 'Invalid minutes value';
  END IF;

  INSERT INTO public.app_settings (key, value, updated_by, updated_at)
  VALUES ('auto_deliver_minutes', COALESCE(to_jsonb(p_minutes), 'null'::jsonb), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = COALESCE(to_jsonb(p_minutes), 'null'::jsonb), updated_by = auth.uid(), updated_at = now();
END;
$function$;