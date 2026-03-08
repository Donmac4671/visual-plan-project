
-- Drop all restrictive policies on complaints
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admin can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can insert own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admin can update all complaints" ON public.complaints;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view own complaints"
  ON public.complaints FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all complaints"
  ON public.complaints FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own complaints"
  ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update all complaints"
  ON public.complaints FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
