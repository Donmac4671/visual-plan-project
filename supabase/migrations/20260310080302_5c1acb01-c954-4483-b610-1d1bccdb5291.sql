
CREATE TABLE public.hidden_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id text NOT NULL,
  bundle_size text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (network_id, bundle_size)
);

ALTER TABLE public.hidden_bundles ENABLE ROW LEVEL SECURITY;

-- Everyone can read (to filter bundles on client)
CREATE POLICY "Anyone can view hidden bundles"
ON public.hidden_bundles FOR SELECT
TO public
USING (true);

-- Only admins can insert
CREATE POLICY "Admin can insert hidden bundles"
ON public.hidden_bundles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admin can delete hidden bundles"
ON public.hidden_bundles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
