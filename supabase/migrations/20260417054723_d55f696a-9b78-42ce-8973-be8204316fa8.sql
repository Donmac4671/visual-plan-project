-- Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Refund function (called by service role from fulfill-order on failure)
CREATE OR REPLACE FUNCTION public.refund_failed_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Only refund wallet payments and only once
  IF v_order.payment_method <> 'wallet' THEN RETURN; END IF;
  IF v_order.status = 'failed' THEN
    -- Check if refund already issued
    IF EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = v_order.user_id
        AND type = 'refund'
        AND description LIKE '%' || v_order.order_ref || '%'
    ) THEN
      RETURN;
    END IF;
  END IF;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_order.amount
    WHERE user_id = v_order.user_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (
    v_order.user_id,
    'refund',
    'Refund for failed order ' || v_order.order_ref || ' (' || v_order.network || ' ' || v_order.bundle_size || ')',
    v_order.amount,
    'completed'
  );
END;
$$;