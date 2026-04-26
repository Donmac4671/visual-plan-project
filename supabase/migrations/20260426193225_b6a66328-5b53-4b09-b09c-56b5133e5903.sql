-- Allow anonymous (signed-out) push subscriptions
ALTER TABLE public.push_subscriptions ALTER COLUMN user_id DROP NOT NULL;

-- Ensure endpoint uniqueness for upsert dedupe
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique ON public.push_subscriptions (endpoint);

-- Allow anonymous users to insert subscriptions where user_id IS NULL
DROP POLICY IF EXISTS "Anyone can insert anonymous push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Anyone can insert anonymous push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Allow updates on anonymous rows (needed for upsert by endpoint)
DROP POLICY IF EXISTS "Anyone can update anonymous push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Anyone can update anonymous push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO anon, authenticated
USING (user_id IS NULL OR auth.uid() = user_id);