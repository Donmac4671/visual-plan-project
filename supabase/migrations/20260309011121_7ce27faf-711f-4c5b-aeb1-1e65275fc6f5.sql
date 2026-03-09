-- Fix RLS policy types: Convert all RESTRICTIVE policies to PERMISSIVE
-- This ensures that access controls are actually enforced

-- agent_applications table
DROP POLICY IF EXISTS "Users can view own applications" ON public.agent_applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON public.agent_applications;
DROP POLICY IF EXISTS "Admin can view all applications" ON public.agent_applications;
DROP POLICY IF EXISTS "Admin can update all applications" ON public.agent_applications;
DROP POLICY IF EXISTS "Admin can delete applications" ON public.agent_applications;

CREATE POLICY "Users can view own applications" ON public.agent_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications" ON public.agent_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all applications" ON public.agent_applications
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update all applications" ON public.agent_applications
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete applications" ON public.agent_applications
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- complaints table
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admin can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can insert own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admin can update all complaints" ON public.complaints;

CREATE POLICY "Users can view own complaints" ON public.complaints
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all complaints" ON public.complaints
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own complaints" ON public.complaints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update all complaints" ON public.complaints
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- orders table
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;

CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all orders" ON public.orders
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update all orders" ON public.orders
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete orders" ON public.orders
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id 
    AND wallet_balance = (SELECT wallet_balance FROM public.profiles WHERE user_id = auth.uid())
    AND tier = (SELECT tier FROM public.profiles WHERE user_id = auth.uid())
    AND is_blocked = (SELECT is_blocked FROM public.profiles WHERE user_id = auth.uid())
    AND agent_code = (SELECT agent_code FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- transactions table
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admin can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admin can insert transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all transactions" ON public.transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles table
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- wallet_topups table
DROP POLICY IF EXISTS "Users can view own topups" ON public.wallet_topups;
DROP POLICY IF EXISTS "Admin can view all topups" ON public.wallet_topups;
DROP POLICY IF EXISTS "Users can insert own topups" ON public.wallet_topups;
DROP POLICY IF EXISTS "Admin can update all topups" ON public.wallet_topups;
DROP POLICY IF EXISTS "Admin can delete topups" ON public.wallet_topups;

CREATE POLICY "Users can view own topups" ON public.wallet_topups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all topups" ON public.wallet_topups
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own topups" ON public.wallet_topups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update all topups" ON public.wallet_topups
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete topups" ON public.wallet_topups
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));