-- Ensure vault extension is available
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Store the service role key in Vault (idempotent: update if already exists)
DO $$
DECLARE
  v_existing_id uuid;
  v_key text := 'eyJhbGciOiJIUzI1NiIsImtpZCI6Ilc3Vk1Ka290TS9nMlIxbk0iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL25remFrd2ZkYWlleHB3b2dlemdxLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0YjkyZDRlNS04ZjAzLTQzZTgtYjY0OC0xYjE0OWU3MmRhMzciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc2NTc4ODE2LCJpYXQiOjE3NzY1NzUyMTYsImVtYWlsIjoiIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnt9LCJ1c2VyX21ldGFkYXRhIjp7fSwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImFhbCI6ImFhbDEiLCJhbXIiOltdLCJzZXNzaW9uX2lkIjoiIn0.';
BEGIN
  -- We can't read the actual service_role_key in SQL, so we use a placeholder lookup approach:
  -- Instead, write a function that fetches from vault by name. Insert empty if missing — admin will set via dashboard if needed.
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'service_role_key';
  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret('PLACEHOLDER_SET_VIA_DASHBOARD', 'service_role_key', 'Service role key used by notify_dispatcher trigger');
  END IF;
END $$;

-- Rewrite the trigger to read from vault
CREATE OR REPLACE FUNCTION public.notify_dispatcher()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_url text := 'https://nkzakwfdaiexpwogezgq.supabase.co/functions/v1/notifications-dispatcher';
  v_service_key text;
  v_payload jsonb;
BEGIN
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL OR v_service_key = '' OR v_service_key = 'PLACEHOLDER_SET_VIA_DASHBOARD' THEN
    RAISE WARNING 'notify_dispatcher: service_role_key not set in vault — skipping';
    RETURN COALESCE(NEW, OLD);
  END IF;

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
      'Authorization', 'Bearer ' || v_service_key,
      'apikey', v_service_key
    ),
    body := v_payload
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  RAISE WARNING 'notify_dispatcher failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$function$;