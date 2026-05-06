CREATE OR REPLACE FUNCTION public.run_auto_deliver()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_minutes int;
  v_val jsonb;
  v_count int := 0;
BEGIN
  SELECT value INTO v_val FROM public.app_settings WHERE key = 'auto_deliver_minutes';
  IF v_val IS NULL OR v_val = 'null'::jsonb THEN RETURN 0; END IF;
  v_minutes := (v_val)::text::int;
  IF v_minutes IS NULL OR v_minutes <= 0 THEN RETURN 0; END IF;

  WITH updated AS (
    UPDATE public.orders
       SET status = 'completed'
     WHERE status IN ('pending','processing','waiting')
       AND gh_reference IS NOT NULL
       AND created_at <= now() - make_interval(mins => v_minutes)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$function$;