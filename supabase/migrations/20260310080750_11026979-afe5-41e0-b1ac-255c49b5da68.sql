
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_percent numeric NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  description text NOT NULL DEFAULT '',
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Everyone can read active promos
CREATE POLICY "Anyone can view promotions"
ON public.promotions FOR SELECT
TO public
USING (true);

-- Only admins can insert
CREATE POLICY "Admin can insert promotions"
ON public.promotions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admin can update promotions"
ON public.promotions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admin can delete promotions"
ON public.promotions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
