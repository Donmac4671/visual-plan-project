
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'user' CHECK (sender_role IN ('user', 'admin')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages"
ON public.chat_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all chat messages"
ON public.chat_messages FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id AND sender_role = 'user');

CREATE POLICY "Admin can insert chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update chat messages"
ON public.chat_messages FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
