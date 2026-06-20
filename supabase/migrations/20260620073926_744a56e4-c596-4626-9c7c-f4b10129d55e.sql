
CREATE TABLE IF NOT EXISTS public.admin_cost_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  bundle_size text NOT NULL,
  cost numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network, bundle_size)
);

GRANT SELECT ON public.admin_cost_prices TO authenticated;
GRANT ALL ON public.admin_cost_prices TO service_role;

ALTER TABLE public.admin_cost_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cost prices"
  ON public.admin_cost_prices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read cost prices"
  ON public.admin_cost_prices FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER admin_cost_prices_updated_at
  BEFORE UPDATE ON public.admin_cost_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with the current hardcoded cost map so nothing breaks on first load
INSERT INTO public.admin_cost_prices (network, bundle_size, cost) VALUES
  ('MTN','1GB',3.74),('MTN','2GB',7.47),('MTN','3GB',11.22),('MTN','4GB',14.94),
  ('MTN','5GB',18.69),('MTN','6GB',22.42),('MTN','7GB',26.16),('MTN','8GB',29.90),
  ('MTN','10GB',37.37),('MTN','15GB',56.06),('MTN','20GB',74.74),('MTN','25GB',93.47),
  ('MTN','30GB',112.11),('MTN','40GB',149.48),('MTN','50GB',186.85),
  ('TELECEL','2GB',9.09),('TELECEL','3GB',13.54),('TELECEL','5GB',19.09),
  ('TELECEL','10GB',36.26),('TELECEL','15GB',53.43),('TELECEL','20GB',70.7),
  ('TELECEL','30GB',104.03),('TELECEL','40GB',138.37),('TELECEL','50GB',172.71),
  ('AT BIG TIME','15GB',47.47),('AT BIG TIME','20GB',55.55),('AT BIG TIME','30GB',65.65),
  ('AT BIG TIME','40GB',78.78),('AT BIG TIME','50GB',86.86),('AT BIG TIME','60GB',98.98),
  ('AT BIG TIME','70GB',121.2),('AT BIG TIME','80GB',141.4),('AT BIG TIME','90GB',151.5),
  ('AT BIG TIME','100GB',161.6),('AT BIG TIME','130GB',202.0),('AT BIG TIME','140GB',225.23),
  ('AT BIG TIME','150GB',250.48),('AT BIG TIME','200GB',321.18),
  ('AT PREMIUM','1GB',3.73),('AT PREMIUM','2GB',7.46),('AT PREMIUM','3GB',11.21),
  ('AT PREMIUM','4GB',14.95),('AT PREMIUM','5GB',18.69),('AT PREMIUM','6GB',22.42),
  ('AT PREMIUM','7GB',26.16),('AT PREMIUM','8GB',29.9),('AT PREMIUM','10GB',37.27),
  ('AT PREMIUM','12GB',44.84),('AT PREMIUM','15GB',56.05),('AT PREMIUM','20GB',74.74),
  ('AT PREMIUM','25GB',93.43),('AT PREMIUM','30GB',112.11),
  ('MTN Mashup Data','1.7GB',3.6),('MTN Mashup Data','3.4GB',6.6),
  ('MTN Mashup Data','5.1GB',9.6),('MTN Mashup Data','6.8GB',13.2),
  ('MTN Mashup Data','8.2GB',13),('MTN Mashup Data','8.5GB',16.8),
  ('MTN Mashup Data','10.2GB',21),('MTN Mashup Data','12GB',16),
  ('MTN Mashup Data','15GB',20),('MTN Mashup Data','15.3GB',30),
  ('MTN Mashup Data','20.4GB',36),
  ('MTN Mashup Combo','350m+870MB',12),('MTN Mashup Combo','700m+1.6GB',18),
  ('MTN Mashup Combo','1000m+2.6GB',24),('MTN Mashup Combo','1400m+3.5GB',30)
ON CONFLICT (network, bundle_size) DO NOTHING;
