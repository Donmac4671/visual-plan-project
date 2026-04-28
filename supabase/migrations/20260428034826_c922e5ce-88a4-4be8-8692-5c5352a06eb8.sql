
-- 1. Make chat-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

-- Drop existing permissive policies on chat-media
DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat media" ON storage.objects;

-- New private policies for chat-media: users access their own folder, admins access all
CREATE POLICY "Users can upload own chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media' AND public.has_role(auth.uid(), 'admin'));

-- 2. Tighten verified_topups: prevent any non-admin from seeing unclaimed rows
-- Existing user policy already restricts to claimed_by = auth.uid(); reaffirm by ensuring
-- no other permissive SELECT policy exists. Add explicit policy doc-style by recreating.
DROP POLICY IF EXISTS "Users can view own claimed topups" ON public.verified_topups;
CREATE POLICY "Users can view own claimed topups"
ON public.verified_topups FOR SELECT TO authenticated
USING (claimed_by = auth.uid() AND is_claimed = true);

-- 3. Lock down SECURITY DEFINER functions: revoke EXECUTE from anon and PUBLIC.
-- Keep EXECUTE for authenticated where needed (user-callable RPCs).
REVOKE EXECUTE ON FUNCTION public.pay_with_wallet(text, text, text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pay_order_with_paystack(text, text, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_paystack_topup(numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_verified_topup(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_referral(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refund_failed_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_order_ref() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_pending_orders() FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs: only authenticated may call (function checks has_role internally)
REVOKE EXECUTE ON FUNCTION public.admin_toggle_admin_role(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_wallet_operation(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_block(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_tier(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pay_order_with_paystack_for_user(uuid, text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_paystack_topup_for_user(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- 4. Realtime authorization: add RLS on realtime.messages so users can only subscribe
-- to their own user-scoped topics, and admins can subscribe to admin topics.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users subscribe to own topics" ON realtime.messages;
CREATE POLICY "Users subscribe to own topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Allow user-scoped channels containing their uid, or admin channels for admins
  (realtime.topic() LIKE '%' || auth.uid()::text || '%')
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Users broadcast to own topics" ON realtime.messages;
CREATE POLICY "Users broadcast to own topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  (realtime.topic() LIKE '%' || auth.uid()::text || '%')
  OR public.has_role(auth.uid(), 'admin')
);
