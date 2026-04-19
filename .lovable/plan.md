

## Root cause

The `notify_dispatcher` DB trigger reads `current_setting('app.settings.service_role_key', true)` to authenticate to the edge function — but that setting was never configured, so it sends `Authorization: Bearer ` (empty). The edge gateway silently drops these (118 of 121 pg_net calls in the last 2 hours have NULL status). Result: **the dispatcher never runs**, so:

- Non-admin users get no push notifications at all.
- The admin appears to "receive" them only because `RealtimeNotifications.tsx` shows in-app toasts to admins via Supabase Realtime — but those aren't real OS push, they're just toasts visible while the tab is open.

This is why every platform (Android, iPhone, Windows) seems broken for everyone except the admin.

## Fix

**1. Make the trigger authenticate properly.** Two options, will use Vault (the safe one):
   - Store the service role key in `vault.secrets` as `service_role_key`.
   - Rewrite `notify_dispatcher` to read from `vault.decrypted_secrets` instead of `current_setting`.

**2. Backfill subscriptions for existing users** — only 3 users have ever subscribed. Most users probably dismissed the permission prompt or the push subscription failed silently. Will:
   - Surface a small "Enable notifications" button in the dashboard header for any logged-in user without an active subscription, so they can re-trigger the prompt anytime (instead of only the silent attempt at login).
   - Add iOS-specific guidance: Web Push on iPhone only works after the user does **Share → Add to Home Screen** and opens the app from the home-screen icon. We'll detect iOS Safari (not standalone) and show a one-time inline hint with the steps.

**3. Verify end-to-end** by:
   - Re-running the trigger manually (insert a test order) and checking pg_net response is 200.
   - Checking `send-push` logs show real send attempts to the right user_ids.

## Files to change

- New SQL migration: store `service_role_key` in Vault, rewrite `public.notify_dispatcher` to use it.
- `src/components/global/RealtimeNotifications.tsx` (or new small component): add "Enable notifications" button + iOS install hint when permission isn't granted / no subscription exists.
- No edge function changes needed — `send-push` and `notifications-dispatcher` are already correct.

## Notes on iPhone

iOS Web Push **requires** the site be added to the Home Screen (PWA mode). The manifest and apple meta tags are already in place. The only missing piece is telling iPhone users to do "Share → Add to Home Screen" — they're almost certainly opening the site in Safari, where iOS blocks all Web Push. The new inline hint will fix this.

## Notes on Windows / Android

Once the trigger auth is fixed, both will work as soon as the user grants permission. Existing 2 non-admin subscribers will start receiving pushes immediately after the migration runs.

