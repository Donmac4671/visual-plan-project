
CREATE TABLE public.site_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active messages" ON public.site_messages
  FOR SELECT TO public USING (true);

CREATE POLICY "Admin can insert messages" ON public.site_messages
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update messages" ON public.site_messages
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete messages" ON public.site_messages
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
