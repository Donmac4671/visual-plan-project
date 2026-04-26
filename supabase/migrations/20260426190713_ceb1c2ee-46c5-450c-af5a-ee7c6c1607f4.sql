-- 1) Bump pg_net timeout so multi-push dispatch doesn't get cancelled at 5s.
CREATE OR REPLACE FUNCTION public.notify_dispatcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text := 'https://nkzakwfdaiexpwogezgq.supabase.co/functions/v1/notifications-dispatcher';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5remFrd2ZkYWlleHB3b2dlemdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDUzODUsImV4cCI6MjA4ODMyMTM4NX0.xlRHrYZdW4e6kSru-yRTtDbT0MP4x7Py8DvY7kwCHCE';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,
    'old_record', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key
    ),
    body := v_payload,
    timeout_milliseconds := 30000
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  RAISE WARNING 'notify_dispatcher failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2) Broadcasts table: admin-composed messages pushed to all users.
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  url text NOT NULL DEFAULT '/dashboard',
  audience text NOT NULL DEFAULT 'all', -- 'all' | 'general' | 'agent'
  sent_by uuid,
  recipients_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view broadcasts" ON public.broadcasts;
CREATE POLICY "Admin can view broadcasts"
ON public.broadcasts FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin can insert broadcasts" ON public.broadcasts;
CREATE POLICY "Admin can insert broadcasts"
ON public.broadcasts FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin can delete broadcasts" ON public.broadcasts;
CREATE POLICY "Admin can delete broadcasts"
ON public.broadcasts FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));