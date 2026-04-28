ALTER TABLE public.site_messages
ADD COLUMN IF NOT EXISTS show_as_banner boolean NOT NULL DEFAULT false;