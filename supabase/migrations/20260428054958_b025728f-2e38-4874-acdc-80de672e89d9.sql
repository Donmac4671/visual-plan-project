DROP POLICY IF EXISTS "Users subscribe to own topics" ON realtime.messages;
DROP POLICY IF EXISTS "Users broadcast to own topics" ON realtime.messages;

CREATE POLICY "Users subscribe to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ ('-' || (auth.uid())::text || '$')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users broadcast to own topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() ~ ('-' || (auth.uid())::text || '$')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);