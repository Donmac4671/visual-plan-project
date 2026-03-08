
-- Add tier column to profiles: 'general' (default) or 'agent'
ALTER TABLE public.profiles ADD COLUMN tier text NOT NULL DEFAULT 'general';

-- Update existing users to 'agent' since they were created before this change
UPDATE public.profiles SET tier = 'agent';

-- Create admin function to change user tier
CREATE OR REPLACE FUNCTION public.admin_set_user_tier(target_user_id uuid, new_tier text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_agent_number INT;
  new_agent_code TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF new_tier NOT IN ('general', 'agent') THEN
    RAISE EXCEPTION 'Invalid tier: %', new_tier;
  END IF;

  -- If upgrading to agent, assign an agent code if they don't have one
  IF new_tier = 'agent' THEN
    -- Check if user already has a meaningful agent code
    IF (SELECT agent_code FROM public.profiles WHERE user_id = target_user_id) = '' THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(agent_code FROM 'Agent (\d+)') AS INT)), 0) + 1
      INTO new_agent_number
      FROM public.profiles
      WHERE agent_code != '';

      new_agent_code := 'Agent ' || lpad(new_agent_number::text, 3, '0');
      UPDATE public.profiles SET tier = new_tier, agent_code = new_agent_code WHERE user_id = target_user_id;
      RETURN;
    END IF;
  END IF;

  UPDATE public.profiles SET tier = new_tier WHERE user_id = target_user_id;
END;
$$;
