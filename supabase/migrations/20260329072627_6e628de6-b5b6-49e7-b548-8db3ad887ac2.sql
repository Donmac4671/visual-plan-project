
-- Allow authenticated users to insert referrals (for registration flow)
CREATE POLICY "Users can insert referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (referred_id = auth.uid());
