
-- Update the handle_new_user function to auto-assign admin role to the admin email
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
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  
  -- Auto-assign admin role for the admin email
  IF NEW.email = 'donmacdatahub@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$;
