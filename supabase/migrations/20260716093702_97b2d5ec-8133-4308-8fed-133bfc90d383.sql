
CREATE OR REPLACE FUNCTION public.is_safe_webhook_url(p_url text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_host text;
  v_port text;
  v_scheme text;
  v_after text;
  v_hostport text;
  v_octets text[];
  v_o1 int; v_o2 int;
BEGIN
  IF p_url IS NULL THEN RETURN false; END IF;

  -- Scheme: only http/https
  IF p_url ~* '^https?://' THEN
    v_scheme := lower(substring(p_url from '^(https?)://'));
  ELSE
    RETURN false;
  END IF;

  -- Strip scheme, credentials, path
  v_after := regexp_replace(p_url, '^https?://', '', 'i');
  v_after := regexp_replace(v_after, '^[^@/]*@', '');           -- strip userinfo
  v_hostport := split_part(split_part(split_part(v_after, '/', 1), '?', 1), '#', 1);

  IF v_hostport = '' THEN RETURN false; END IF;

  -- IPv6 literal not allowed (blocks ::1, fc00::/7, etc.)
  IF position('[' in v_hostport) > 0 THEN RETURN false; END IF;

  IF position(':' in v_hostport) > 0 THEN
    v_host := split_part(v_hostport, ':', 1);
    v_port := split_part(v_hostport, ':', 2);
  ELSE
    v_host := v_hostport;
    v_port := CASE WHEN v_scheme = 'https' THEN '443' ELSE '80' END;
  END IF;

  v_host := lower(v_host);

  -- Only standard web ports
  IF v_port NOT IN ('80','443') THEN RETURN false; END IF;

  -- Empty host
  IF v_host = '' THEN RETURN false; END IF;

  -- Blocked hostnames
  IF v_host IN ('localhost','ip6-localhost','ip6-loopback','metadata','metadata.google.internal','metadata.goog') THEN
    RETURN false;
  END IF;
  IF v_host LIKE '%.localhost' OR v_host LIKE '%.local' OR v_host LIKE '%.internal' THEN
    RETURN false;
  END IF;

  -- IPv4 literal checks
  IF v_host ~ '^\d{1,3}(\.\d{1,3}){3}$' THEN
    v_octets := string_to_array(v_host, '.');
    v_o1 := v_octets[1]::int;
    v_o2 := v_octets[2]::int;
    IF v_o1 = 0 OR v_o1 = 10 OR v_o1 = 127 OR v_o1 >= 224 THEN RETURN false; END IF;
    IF v_o1 = 169 AND v_o2 = 254 THEN RETURN false; END IF;   -- link-local / cloud metadata
    IF v_o1 = 172 AND v_o2 BETWEEN 16 AND 31 THEN RETURN false; END IF;
    IF v_o1 = 192 AND v_o2 = 168 THEN RETURN false; END IF;
    IF v_o1 = 100 AND v_o2 BETWEEN 64 AND 127 THEN RETURN false; END IF; -- CGNAT
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_api_webhook(p_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_secret text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_url IS NULL OR p_url !~* '^https?://' THEN RAISE EXCEPTION 'Invalid URL'; END IF;
  IF NOT public.is_safe_webhook_url(p_url) THEN
    RAISE EXCEPTION 'Webhook URL is not allowed. Use a public https URL on port 80 or 443; private, loopback, link-local and cloud-metadata addresses are blocked.';
  END IF;

  v_secret := 'whsec_' || public._random_token(40);

  INSERT INTO public.api_webhooks (user_id, url, secret)
  VALUES (v_user, p_url, v_secret)
  ON CONFLICT (user_id) DO UPDATE
    SET url = EXCLUDED.url, secret = EXCLUDED.secret, updated_at = now();

  RETURN jsonb_build_object('url', p_url, 'secret', v_secret);
END;
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_user_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hook RECORD;
  v_payload jsonb;
  v_sig text;
  v_body text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT url, secret INTO v_hook FROM public.api_webhooks WHERE user_id = NEW.user_id;
  IF v_hook.url IS NULL THEN RETURN NEW; END IF;

  -- Re-validate on every send (DNS rebinding / policy changes since save)
  IF NOT public.is_safe_webhook_url(v_hook.url) THEN
    RAISE WARNING 'dispatch_user_webhook: blocked unsafe webhook URL for user %', NEW.user_id;
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'event', 'order.' || NEW.status,
    'order', jsonb_build_object(
      'id', NEW.id,
      'order_ref', NEW.order_ref,
      'network', NEW.network,
      'phone_number', NEW.phone_number,
      'bundle_size', NEW.bundle_size,
      'amount', NEW.amount,
      'status', NEW.status,
      'created_at', NEW.created_at
    ),
    'timestamp', extract(epoch from now())::bigint
  );
  v_body := v_payload::text;
  v_sig := encode(extensions.hmac(v_body, v_hook.secret, 'sha256'), 'hex');

  PERFORM net.http_post(
    url := v_hook.url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Donmac-Signature', v_sig,
      'X-Donmac-Event', 'order.' || NEW.status
    ),
    body := v_payload,
    timeout_milliseconds := 10000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_user_webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;
