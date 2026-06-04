-- Update MTN bundle prices
INSERT INTO public.custom_bundles (network_id, bundle_size, size_gb, agent_price, general_price)
VALUES
  ('mtn', '1GB', 1, 4, 4),
  ('mtn', '2GB', 2, 8, 8),
  ('mtn', '3GB', 3, 12, 12),
  ('mtn', '4GB', 4, 16, 16),
  ('mtn', '5GB', 5, 20, 20),
  ('mtn', '6GB', 6, 24, 24),
  ('mtn', '7GB', 7, 28, 28),
  ('mtn', '8GB', 8, 32, 32),
  ('mtn', '10GB', 10, 40, 40),
  ('mtn', '15GB', 15, 60, 60),
  ('mtn', '20GB', 20, 80, 80),
  ('mtn', '25GB', 25, 100, 100),
  ('mtn', '30GB', 30, 120, 120),
  ('mtn', '40GB', 40, 160, 160),
  ('mtn', '50GB', 50, 200, 200)
ON CONFLICT (network_id, bundle_size)
DO UPDATE SET
  agent_price = EXCLUDED.agent_price,
  general_price = EXCLUDED.general_price,
  size_gb = EXCLUDED.size_gb;

-- Update AT Premium bundle prices
INSERT INTO public.custom_bundles (network_id, bundle_size, size_gb, agent_price, general_price)
VALUES
  ('at-premium', '1GB', 1, 4, 4),
  ('at-premium', '2GB', 2, 8, 8),
  ('at-premium', '3GB', 3, 12.10, 12.10),
  ('at-premium', '4GB', 4, 16.10, 16.10),
  ('at-premium', '5GB', 5, 20.10, 20.10),
  ('at-premium', '6GB', 6, 24.10, 24.10),
  ('at-premium', '7GB', 7, 28.10, 28.10),
  ('at-premium', '8GB', 8, 32.10, 32.10),
  ('at-premium', '10GB', 10, 40, 40),
  ('at-premium', '12GB', 12, 48.10, 48.10),
  ('at-premium', '15GB', 15, 60.20, 60.20),
  ('at-premium', '20GB', 20, 80.30, 80.30),
  ('at-premium', '25GB', 25, 100.30, 100.30),
  ('at-premium', '30GB', 30, 120.40, 120.40)
ON CONFLICT (network_id, bundle_size)
DO UPDATE SET
  agent_price = EXCLUDED.agent_price,
  general_price = EXCLUDED.general_price,
  size_gb = EXCLUDED.size_gb;
