
-- 1. Tighten profiles update policy to include reseller_id immutability
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND wallet_balance = (SELECT p.wallet_balance FROM public.profiles p WHERE p.user_id = auth.uid())
  AND tier            = (SELECT p.tier            FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_blocked      = (SELECT p.is_blocked      FROM public.profiles p WHERE p.user_id = auth.uid())
  AND agent_code      = (SELECT p.agent_code      FROM public.profiles p WHERE p.user_id = auth.uid())
  AND reseller_id IS NOT DISTINCT FROM (SELECT p.reseller_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- 2. Restrict app_settings authenticated SELECT to only public product toggle keys
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.app_settings;

CREATE POLICY "Authenticated can view public toggles"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key IN ('mashup_enabled', 'airtime_enabled', 'vs_enabled'));
