DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id)
  AND (wallet_balance = (SELECT p.wallet_balance FROM profiles p WHERE p.user_id = auth.uid()))
  AND (tier = (SELECT p.tier FROM profiles p WHERE p.user_id = auth.uid()))
  AND (is_blocked = (SELECT p.is_blocked FROM profiles p WHERE p.user_id = auth.uid()))
  AND (agent_code = (SELECT p.agent_code FROM profiles p WHERE p.user_id = auth.uid()))
  AND (NOT (reseller_id IS DISTINCT FROM (SELECT p.reseller_id FROM profiles p WHERE p.user_id = auth.uid())))
  AND (referral_code = (SELECT p.referral_code FROM profiles p WHERE p.user_id = auth.uid()))
  AND (NOT (topup_reference_code IS DISTINCT FROM (SELECT p.topup_reference_code FROM profiles p WHERE p.user_id = auth.uid())))
);