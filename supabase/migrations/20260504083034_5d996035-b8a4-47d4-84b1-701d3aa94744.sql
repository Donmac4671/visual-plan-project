-- Settings table for app-wide admin settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete settings" ON public.app_settings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RPC to set auto-deliver minutes (null/0 disables)
CREATE OR REPLACE FUNCTION public.admin_set_auto_deliver_minutes(p_minutes int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_minutes IS NOT NULL AND p_minutes NOT IN (5,10,15,20,30,45,60) THEN
    RAISE EXCEPTION 'Invalid minutes value';
  END IF;

  INSERT INTO public.app_settings (key, value, updated_by, updated_at)
  VALUES ('auto_deliver_minutes', to_jsonb(p_minutes), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;

-- RPC to read it (admins only via RLS otherwise; expose via SECURITY DEFINER for admin UI)
CREATE OR REPLACE FUNCTION public.admin_get_auto_deliver_minutes()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT value INTO v_val FROM public.app_settings WHERE key = 'auto_deliver_minutes';
  IF v_val IS NULL OR v_val = 'null'::jsonb THEN RETURN NULL; END IF;
  RETURN (v_val)::text::int;
END;
$$;

-- Function the cron job calls: auto-complete stale non-final orders
CREATE OR REPLACE FUNCTION public.run_auto_deliver()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
       AND created_at <= now() - make_interval(mins => v_minutes)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;
