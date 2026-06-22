-- Tighten promotions SELECT for authenticated: only active promos, admins see all
DROP POLICY IF EXISTS "Authenticated can view promotions" ON public.promotions;

CREATE POLICY "Authenticated can view active promotions"
ON public.promotions
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));