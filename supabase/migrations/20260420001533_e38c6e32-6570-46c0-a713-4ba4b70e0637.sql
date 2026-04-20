-- Track historical agent code assignments so they can be reused on re-upgrade and never given to anyone else
CREATE TABLE IF NOT EXISTS public.agent_code_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  agent_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_code_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view assignments"
  ON public.agent_code_assignments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Backfill existing assignments from current/former codes on profiles
INSERT INTO public.agent_code_assignments (user_id, agent_code)
SELECT user_id, agent_code FROM public.profiles
WHERE agent_code <> ''
ON CONFLICT (user_id) DO NOTHING;

-- Replace admin_set_user_tier to:
--  - On upgrade to agent: reuse prior code if any, else assign next sequential code (skipping reserved ones)
--  - On downgrade to general: clear agent_code from profile (but keep reservation in agent_code_assignments)
CREATE OR REPLACE FUNCTION public.admin_set_user_tier(target_user_id uuid, new_tier text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_code TEXT;
  new_agent_number INT;
  new_agent_code TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF new_tier NOT IN ('general', 'agent') THEN
    RAISE EXCEPTION 'Invalid tier: %', new_tier;
  END IF;

  IF new_tier = 'agent' THEN
    -- Reuse previously assigned code if any
    SELECT agent_code INTO existing_code
    FROM public.agent_code_assignments
    WHERE user_id = target_user_id;

    IF existing_code IS NULL THEN
      -- Find next free sequential number not already reserved
      SELECT COALESCE(MAX(CAST(SUBSTRING(agent_code FROM 'Agent (\d+)') AS INT)), 0) + 1
      INTO new_agent_number
      FROM public.agent_code_assignments;

      new_agent_code := 'Agent ' || lpad(new_agent_number::text, 3, '0');

      INSERT INTO public.agent_code_assignments (user_id, agent_code)
      VALUES (target_user_id, new_agent_code);
    ELSE
      new_agent_code := existing_code;
    END IF;

    UPDATE public.profiles
      SET tier = 'agent', agent_code = new_agent_code
      WHERE user_id = target_user_id;
  ELSE
    -- Downgrade to general: clear visible code, but keep reservation
    UPDATE public.profiles
      SET tier = 'general', agent_code = ''
      WHERE user_id = target_user_id;
  END IF;
END;
$function$;