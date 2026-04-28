-- Fix protect_profile_fields trigger: allow updates from trusted SECURITY DEFINER RPCs
-- (which execute as the function owner 'postgres'). Without this, RPCs like
-- claim_verified_topup, complete_paystack_topup_for_user, pay_with_wallet,
-- refund_failed_order, admin_wallet_operation silently fail to update wallet_balance/tier/etc.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Trusted server-side context: SECURITY DEFINER RPCs owned by postgres
  IF current_user = 'postgres' OR session_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  -- Admins can change anything
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admin self-updates: lock protected fields to their previous values
  NEW.wallet_balance := OLD.wallet_balance;
  NEW.tier           := OLD.tier;
  NEW.agent_code     := OLD.agent_code;
  NEW.is_blocked     := OLD.is_blocked;
  NEW.referral_code  := OLD.referral_code;
  NEW.user_id        := OLD.user_id;
  NEW.id             := OLD.id;
  NEW.created_at     := OLD.created_at;

  RETURN NEW;
END;
$function$;

-- Reconcile wallet balances to match the transactions ledger (source of truth).
-- Floors negatives to 0 to avoid leaving users in debt due to historical drift.
UPDATE public.profiles p
SET wallet_balance = GREATEST(0, sub.expected)
FROM (
  SELECT user_id, COALESCE(SUM(amount), 0) AS expected
  FROM public.transactions
  GROUP BY user_id
) sub
WHERE p.user_id = sub.user_id
  AND ABS(p.wallet_balance - sub.expected) > 0.001;