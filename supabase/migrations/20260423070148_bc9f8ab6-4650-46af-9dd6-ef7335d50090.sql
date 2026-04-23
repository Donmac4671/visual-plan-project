ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'waiting'::text, 'completed'::text, 'failed'::text]));

CREATE OR REPLACE FUNCTION public.admin_update_order_status(order_id uuid, new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF new_status NOT IN ('pending', 'processing', 'waiting', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE public.orders
  SET status = new_status
  WHERE id = order_id;
END;
$function$;