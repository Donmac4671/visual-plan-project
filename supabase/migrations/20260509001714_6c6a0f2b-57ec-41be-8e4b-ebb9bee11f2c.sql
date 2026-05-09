-- 1. Restrict claim_verified_topup
REVOKE EXECUTE ON FUNCTION public.claim_verified_topup(text) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.claim_verified_topup(text) TO service_role;

-- 2. Storage policies (skip ones that already exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update own payment screenshots') THEN
    CREATE POLICY "Users can update own payment screenshots"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete own payment screenshots') THEN
    CREATE POLICY "Users can delete own payment screenshots"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update own agent payments') THEN
    CREATE POLICY "Users can update own agent payments"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'agent-payments' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete own agent payments') THEN
    CREATE POLICY "Users can delete own agent payments"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'agent-payments' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update own chat media') THEN
    CREATE POLICY "Users can update own chat media"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete own chat media') THEN
    CREATE POLICY "Users can delete own chat media"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- 3. Fix mutable search_path on remaining functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;