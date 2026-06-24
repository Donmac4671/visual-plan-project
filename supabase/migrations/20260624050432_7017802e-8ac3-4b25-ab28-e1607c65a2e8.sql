
-- ============ API TOKENS ============
CREATE TABLE public.api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'API Token',
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_tokens_user ON public.api_tokens(user_id);
CREATE INDEX idx_api_tokens_hash ON public.api_tokens(token_hash) WHERE revoked_at IS NULL;

GRANT SELECT ON public.api_tokens TO authenticated;
GRANT ALL ON public.api_tokens TO service_role;

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own tokens"
  ON public.api_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- All mutations go through SECURITY DEFINER RPCs; no direct write policies.

-- ============ API WEBHOOKS ============
CREATE TABLE public.api_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.api_webhooks TO authenticated;
GRANT ALL ON public.api_webhooks TO service_role;

ALTER TABLE public.api_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own webhook"
  ON public.api_webhooks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============ HELPER: random token ============
CREATE OR REPLACE FUNCTION public._random_token(p_len int)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  v_out text := '';
  i int;
BEGIN
  FOR i IN 1..p_len LOOP
    v_out := v_out || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  END LOOP;
  RETURN v_out;
END;
$$;

-- ============ CREATE TOKEN ============
CREATE OR REPLACE FUNCTION public.create_api_token(p_name text DEFAULT 'API Token')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_raw text;
  v_token text;
  v_prefix text;
  v_hash text;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF (SELECT count(*) FROM public.api_tokens WHERE user_id = v_user AND revoked_at IS NULL) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 active tokens. Delete one first.';
  END IF;

  v_raw := public._random_token(40);
  v_token := 'dmh_live_' || v_raw;
  v_prefix := substr(v_token, 1, 16);
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.api_tokens (user_id, name, token_prefix, token_hash)
  VALUES (v_user, COALESCE(NULLIF(trim(p_name), ''), 'API Token'), v_prefix, v_hash)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'prefix', v_prefix);
END;
$$;

-- ============ DELETE TOKEN ============
CREATE OR REPLACE FUNCTION public.delete_api_token(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.api_tokens WHERE id = p_id AND user_id = auth.uid();
END;
$$;

-- ============ REGENERATE TOKEN ============
CREATE OR REPLACE FUNCTION public.regenerate_api_token(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT name INTO v_name FROM public.api_tokens WHERE id = p_id AND user_id = auth.uid();
  IF v_name IS NULL THEN RAISE EXCEPTION 'Token not found'; END IF;
  DELETE FROM public.api_tokens WHERE id = p_id AND user_id = auth.uid();
  RETURN public.create_api_token(v_name);
END;
$$;

-- ============ WEBHOOK MANAGEMENT ============
CREATE OR REPLACE FUNCTION public.set_api_webhook(p_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_secret text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_url IS NULL OR p_url !~* '^https?://' THEN RAISE EXCEPTION 'Invalid URL'; END IF;

  v_secret := 'whsec_' || public._random_token(40);

  INSERT INTO public.api_webhooks (user_id, url, secret)
  VALUES (v_user, p_url, v_secret)
  ON CONFLICT (user_id) DO UPDATE
    SET url = EXCLUDED.url, secret = EXCLUDED.secret, updated_at = now();

  RETURN jsonb_build_object('url', p_url, 'secret', v_secret);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_api_webhook()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.api_webhooks WHERE user_id = auth.uid();
END;
$$;

-- ============ VERIFY TOKEN (service-role only via edge function) ============
CREATE OR REPLACE FUNCTION public.verify_api_token(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_user uuid;
  v_id uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN RETURN NULL; END IF;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  SELECT id, user_id INTO v_id, v_user
    FROM public.api_tokens
    WHERE token_hash = v_hash AND revoked_at IS NULL;
  IF v_user IS NULL THEN RETURN NULL; END IF;
  UPDATE public.api_tokens SET last_used_at = now() WHERE id = v_id;
  RETURN v_user;
END;
$$;

-- ============ API ORDER PLACEMENT (wallet) ============
CREATE OR REPLACE FUNCTION public.api_place_wallet_order(p_user uuid, p_network text, p_phone text, p_bundle text, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_order_id uuid;
  v_ref text;
BEGIN
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE user_id = p_user;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id = p_user;
  v_ref := public.next_order_ref();

  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (p_user, v_ref, p_network, p_phone, p_bundle, p_amount, 'processing', 'wallet')
  RETURNING id INTO v_order_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (p_user, 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone || ' (API)', -p_amount, 'completed');

  RETURN jsonb_build_object('id', v_order_id, 'order_ref', v_ref, 'status', 'processing');
END;
$$;

-- ============ WEBHOOK DISPATCH TRIGGER ============
CREATE OR REPLACE FUNCTION public.dispatch_user_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_dispatch_user_webhook ON public.orders;
CREATE TRIGGER trg_dispatch_user_webhook
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.dispatch_user_webhook();
