-- Allow authenticated users to read app_settings (needed for product visibility flags)
CREATE POLICY "Authenticated can view settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- Seed mashup/airtime toggles (default: enabled)
INSERT INTO public.app_settings (key, value)
VALUES ('mashup_enabled', 'true'::jsonb), ('airtime_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;