DROP POLICY IF EXISTS "Anyone can update anonymous push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Anyone can update anonymous push subscriptions" ON public.push_subscriptions
  FOR UPDATE
  USING ((user_id IS NULL) OR (auth.uid() = user_id))
  WITH CHECK ((user_id IS NULL) OR (auth.uid() = user_id));