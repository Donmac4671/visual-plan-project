CREATE POLICY "Users can view own agent code assignment"
ON public.agent_code_assignments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);