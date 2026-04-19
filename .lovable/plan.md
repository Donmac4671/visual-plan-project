

## Issues

**1. Referrals not showing**
The `referrals` row is created when someone registers using a code. Need to check `Register.tsx` to confirm it inserts into `referrals` with the right `referrer_id`.

**2. Order status not syncing**
The `ghconnect-webhook` matches on `gh_reference`, but I need to verify that `fulfill-order` actually saves the provider's reference back into `orders.gh_reference`. If it doesn't, no webhook will ever match.

## Investigation needed (will do in default mode)

1. Read `src/pages/Register.tsx` — confirm referral insert logic and that it runs against the right user.
2. Read `supabase/functions/fulfill-order/index.ts` — confirm `gh_reference` is captured from the provider response and written to `orders`.
3. Query DB:
   - `SELECT count(*), referrer_id FROM referrals GROUP BY referrer_id` — see if rows actually exist.
   - `SELECT id, order_ref, gh_reference, status, created_at FROM orders ORDER BY created_at DESC LIMIT 20` — see if `gh_reference` is populated on recent orders.
4. Check `ghconnect-webhook` edge logs to see if GHData is even calling it and with what payload.

## Fix plan

**Referrals**
- If `Register.tsx` is missing the insert (or inserting with the wrong id / before the user row exists), patch it to:
  - Read `?ref=CODE` from URL.
  - After successful signup, look up the referrer by `referral_code`, then insert `{referrer_id, referred_id: newUser.id, referral_code}` into `referrals`.
- Backfill: for any existing users whose `profiles.referral_code` matches a stored cookie/localStorage ref, insert missing rows (only if data is recoverable — otherwise just fix going forward).

**Order status sync**
- If `gh_reference` is not being saved: patch `fulfill-order` to extract the provider's reference (`reference`, `data.reference`, `transaction_id`, etc.) from the GHData response and `UPDATE orders SET gh_reference = ... WHERE id = ...` right after a successful purchase.
- If GHData webhook isn't firing at all: log payload shape from edge logs and adjust the matcher (already accepts `reference`, `trxref`, `data.reference`, `data.trxref`).
- Add a fallback: an admin "Re-sync" button that calls a new `ghconnect-status` edge function to query GHData for a single order's status on demand.

**Verification**
- Place a test order, confirm `gh_reference` is saved, manually flip status on GHData, watch the row update.
- Register a new test account with `?ref=YOURCODE`, confirm it shows up in your referral list immediately.

## Files likely to change

- `src/pages/Register.tsx` (referral insert)
- `supabase/functions/fulfill-order/index.ts` (save `gh_reference`)
- `supabase/functions/ghconnect-webhook/index.ts` (logging + matcher hardening if needed)
- Possibly new `supabase/functions/ghconnect-status/index.ts` (manual re-sync)
- Possibly `src/components/admin/AdminLiveChat.tsx` or admin orders view (re-sync button)

