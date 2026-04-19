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
    body := v_payload
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  RAISE WARNING 'notify_dispatcher failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Ensure triggers exist on the relevant tables
DROP TRIGGER IF EXISTS notify_orders ON public.orders;
CREATE TRIGGER notify_orders AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

DROP TRIGGER IF EXISTS notify_wallet_topups ON public.wallet_topups;
CREATE TRIGGER notify_wallet_topups AFTER INSERT OR UPDATE ON public.wallet_topups
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

DROP TRIGGER IF EXISTS notify_complaints ON public.complaints;
CREATE TRIGGER notify_complaints AFTER INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

DROP TRIGGER IF EXISTS notify_chat_messages ON public.chat_messages;
CREATE TRIGGER notify_chat_messages AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

DROP TRIGGER IF EXISTS notify_referrals ON public.referrals;
CREATE TRIGGER notify_referrals AFTER INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();

DROP TRIGGER IF EXISTS notify_agent_applications ON public.agent_applications;
CREATE TRIGGER notify_agent_applications AFTER INSERT ON public.agent_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatcher();