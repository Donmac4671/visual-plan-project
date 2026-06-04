-- Clean slate: Clear custom bundles for MTN and AT Premium to resolve inconsistencies
DELETE FROM public.custom_bundles WHERE LOWER(network_id) IN ('mtn', 'at-premium');

-- Re-insert MTN bundles with correct prices (Agent = General)
INSERT INTO public.custom_bundles (network_id, bundle_size, size_gb, agent_price, general_price)
VALUES
  ('mtn', '1GB', 1, 4.00, 4.00),
  ('mtn', '2GB', 2, 8.00, 8.00),
  ('mtn', '3GB', 3, 12.00, 12.00),
  ('mtn', '4GB', 4, 16.00, 16.00),
  ('mtn', '5GB', 5, 20.00, 20.00),
  ('mtn', '6GB', 6, 24.00, 24.00),
  ('mtn', '7GB', 7, 28.00, 28.00),
  ('mtn', '8GB', 8, 32.00, 32.00),
  ('mtn', '10GB', 10, 40.00, 40.00),
  ('mtn', '15GB', 15, 60.00, 60.00),
  ('mtn', '20GB', 20, 80.00, 80.00),
  ('mtn', '25GB', 25, 100.00, 100.00),
  ('mtn', '30GB', 30, 120.00, 120.00),
  ('mtn', '40GB', 40, 160.00, 160.00),
  ('mtn', '50GB', 50, 200.00, 200.00);

-- Re-insert AT Premium bundles with correct prices (Agent = General)
INSERT INTO public.custom_bundles (network_id, bundle_size, size_gb, agent_price, general_price)
VALUES
  ('at-premium', '1GB', 1, 4.00, 4.00),
  ('at-premium', '2GB', 2, 8.00, 8.00),
  ('at-premium', '3GB', 3, 12.10, 12.10),
  ('at-premium', '4GB', 4, 16.10, 16.10),
  ('at-premium', '5GB', 5, 20.10, 20.10),
  ('at-premium', '6GB', 6, 24.10, 24.10),
  ('at-premium', '7GB', 7, 28.10, 28.10),
  ('at-premium', '8GB', 8, 32.10, 32.10),
  ('at-premium', '10GB', 10, 40.00, 40.00),
  ('at-premium', '12GB', 12, 48.10, 48.10),
  ('at-premium', '15GB', 15, 60.20, 60.20),
  ('at-premium', '20GB', 20, 80.30, 80.30),
  ('at-premium', '25GB', 25, 100.30, 100.30),
  ('at-premium', '30GB', 30, 120.40, 120.40);
