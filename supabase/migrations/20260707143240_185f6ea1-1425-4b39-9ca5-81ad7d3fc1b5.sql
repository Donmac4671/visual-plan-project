GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.push_subscriptions TO anon;
GRANT ALL ON public.push_subscriptions TO service_role;