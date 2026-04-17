-- Enable pg_net for HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Generic dispatcher trigger function
CREATE OR REPLACE FUNCTION public.notify_dispatcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := 'https://nkzakwfdaiexpwogezgq.supabase.co/functions/v1/notifications-dispatcher';
  v_service_key text := current_setting('app.settings.service_role_key', true);
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
      'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
    ),
    body := v_payload
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  -- Never block the original transaction on notification failure
  RAISE WARNING 'notify_dispatcher failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing triggers if re-running
DROP TRIGGER IF EXISTS trg_notify_orders ON public.orders;
DROP TRIGGER IF EXISTS trg_notify_wallet_topups ON public.wallet_topups;
DROP TRIGGER IF EXISTS trg_notify_complaints ON public.complaints;
DROP TRIGGER IF EXISTS trg_notify_chat_messages ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_notify_referrals ON public.referrals;
DROP TRIGGER IF EXISTS trg_notify_agent_applications ON public.agent_applications;

CREATE TRIGGER trg_notify_orders
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

CREATE TRIGGER trg_notify_wallet_topups
  AFTER INSERT OR UPDATE ON public.wallet_topups
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

CREATE TRIGGER trg_notify_complaints
  AFTER INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

CREATE TRIGGER trg_notify_chat_messages
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

CREATE TRIGGER trg_notify_referrals
  AFTER INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

CREATE TRIGGER trg_notify_agent_applications
  AFTER INSERT ON public.agent_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

-- Set the service role key as a DB-wide setting so the trigger can authenticate
-- (Stored as a Postgres setting; not user-visible. Replace via ALTER DATABASE if rotated.)
DO $$
BEGIN
  PERFORM set_config('app.settings.service_role_key',
    current_setting('app.settings.service_role_key', true), false);
END $$;