
-- Create agent_applications table
CREATE TABLE public.agent_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own applications" ON public.agent_applications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert own applications
CREATE POLICY "Users can insert own applications" ON public.agent_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin can view all applications
CREATE POLICY "Admin can view all applications" ON public.agent_applications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update all applications
CREATE POLICY "Admin can update all applications" ON public.agent_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete applications
CREATE POLICY "Admin can delete applications" ON public.agent_applications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for agent payment screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-payments', 'agent-payments', true);

-- Storage policies for agent-payments bucket
CREATE POLICY "Users can upload agent payment screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agent-payments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view agent payment screenshots" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'agent-payments');
