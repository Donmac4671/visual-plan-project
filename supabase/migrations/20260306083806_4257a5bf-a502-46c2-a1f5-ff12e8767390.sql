
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  agent_code TEXT NOT NULL DEFAULT '',
  wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function (must be created before policies that use it)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles RLS
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_ref TEXT NOT NULL,
  network TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  bundle_size TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed')),
  payment_method TEXT NOT NULL DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'paystack')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update all orders" ON public.orders FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'topup', 'credit', 'debit')),
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all transactions" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert transactions" ON public.transactions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create wallet_topups table
CREATE TABLE public.wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('momo', 'paystack')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed')),
  screenshot_url TEXT,
  paystack_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topups" ON public.wallet_topups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own topups" ON public.wallet_topups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all topups" ON public.wallet_topups FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update all topups" ON public.wallet_topups FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', true);

CREATE POLICY "Users can upload screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'payment-screenshots');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration (auto-create profile with agent code)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_agent_number INT;
  new_agent_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(agent_code FROM 'Agent (\d+)') AS INT)), 0) + 1
  INTO new_agent_number
  FROM public.profiles;
  
  new_agent_code := 'Agent ' || lpad(new_agent_number::text, 3, '0');
  
  INSERT INTO public.profiles (user_id, full_name, email, phone, agent_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    new_agent_code
  );
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Admin wallet operations function (credit/debit)
CREATE OR REPLACE FUNCTION public.admin_wallet_operation(
  target_user_id UUID,
  operation_amount NUMERIC,
  operation_type TEXT,
  operation_description TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  IF operation_type = 'credit' THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + operation_amount WHERE user_id = target_user_id;
  ELSIF operation_type = 'debit' THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance - operation_amount WHERE user_id = target_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid operation type';
  END IF;
  
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (target_user_id, operation_type, operation_description, operation_amount, 'completed');
END;
$$;

-- Admin block/unblock user
CREATE OR REPLACE FUNCTION public.admin_toggle_block(target_user_id UUID, block_status BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles SET is_blocked = block_status WHERE user_id = target_user_id;
END;
$$;

-- Admin update order status
CREATE OR REPLACE FUNCTION public.admin_update_order_status(order_id UUID, new_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.orders SET status = new_status WHERE id = order_id;
END;
$$;

-- Wallet payment for orders (deduct from wallet)
CREATE OR REPLACE FUNCTION public.pay_with_wallet(
  p_network TEXT,
  p_phone TEXT,
  p_bundle TEXT,
  p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC;
  new_order_id UUID;
  order_count INT;
  new_ref TEXT;
BEGIN
  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();
  
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  
  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id = auth.uid();
  
  SELECT COUNT(*) + 1 INTO order_count FROM public.orders;
  new_ref := 'ORD-' || lpad(order_count::text, 5, '0');
  
  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, 'pending', 'wallet')
  RETURNING id INTO new_order_id;
  
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone, -p_amount, 'completed');
  
  RETURN new_order_id;
END;
$$;

-- Paystack wallet topup completion
CREATE OR REPLACE FUNCTION public.complete_paystack_topup(
  p_amount NUMERIC,
  p_reference TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE user_id = auth.uid();
  
  INSERT INTO public.wallet_topups (user_id, amount, method, status, paystack_reference)
  VALUES (auth.uid(), p_amount, 'paystack', 'completed', p_reference);
  
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'topup', 'Wallet Top-up via Paystack', p_amount, 'completed');
END;
$$;

-- Paystack order payment
CREATE OR REPLACE FUNCTION public.pay_order_with_paystack(
  p_network TEXT,
  p_phone TEXT,
  p_bundle TEXT,
  p_amount NUMERIC,
  p_reference TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_order_id UUID;
  order_count INT;
  new_ref TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO order_count FROM public.orders;
  new_ref := 'ORD-' || lpad(order_count::text, 5, '0');
  
  INSERT INTO public.orders (user_id, order_ref, network, phone_number, bundle_size, amount, status, payment_method)
  VALUES (auth.uid(), new_ref, p_network, p_phone, p_bundle, p_amount, 'pending', 'paystack')
  RETURNING id INTO new_order_id;
  
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'purchase', p_network || ' ' || p_bundle || ' to ' || p_phone || ' (Paystack)', -p_amount, 'completed');
  
  RETURN new_order_id;
END;
$$;
