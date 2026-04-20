

## Issues to fix

1. **Order status not syncing** — Need to verify `gh_reference` is saved on order creation and webhook is firing.
2. **Verified IDs not visible on laptop** — Likely RLS / realtime cache issue on `verified_topups`.
3. **Delete two mistake accounts** — `hannahgbanwoo22@gmai.com`, `adwoaberry65@gmail.com`.
4. **Duplicate notifications** — Both client Realtime toast AND server push are firing for admin.
5. **Add notification sound** — Sound exists in `notifications.ts` but SW push isn't playing it.

## Investigation (default mode)

- Check `fulfill-order/index.ts` — does it save `gh_reference` after GHData call?
- Check recent orders: `SELECT order_ref, gh_reference, status FROM orders ORDER BY created_at DESC LIMIT 10`
- Check `verified_topups` realtime publication + `AdminVerifiedTopups.tsx` query (maybe filtering claimed by default).
- Check `sw.js` — does the push event play sound? (SW can't use `Audio()` — must use notification `sound` option or client postMessage).

## Fix plan

### 1. Order status sync
- Patch `fulfill-order` to save provider reference into `orders.gh_reference` immediately after GHData responds.
- Add backfill: re-resolve `gh_reference` for recent stuck orders by matching on `order_ref` if GHData echoes it.
- Confirm webhook URL is set on GHData side (user already confirmed).

### 2. Verified IDs visibility on laptop
- Force the admin Verified Top-ups list to refetch on focus + add Realtime subscription on `verified_topups` so both devices stay in sync.
- Verify RLS allows admin to see all rows (already does per schema).

### 3. Delete mistake accounts
- SQL: delete from `profiles`, `user_roles`, `transactions`, `wallet_topups`, `orders`, `referrals`, `push_subscriptions`, `chat_messages`, `complaints`, `agent_applications` for those two emails, then delete from `auth.users`.

### 4. Duplicate notifications
Root cause: admin gets BOTH:
- In-app toast from `RealtimeNotifications.tsx` (Supabase Realtime listener)
- Web Push from `notifications-dispatcher` → `send-push` → SW `showNotification`

Fix: when the tab is **visible**, skip the SW push notification (dispatcher already gates this conceptually but SW shows it anyway). Cleanest fix: in `sw.js` push handler, check `clients.matchAll({type:'window'})` — if any client is `focused`, post a message to the client to show in-app toast and **do not** call `showNotification`. The client side already shows toasts via Realtime, so SW just stays silent when tab is focused.

### 5. Notification sound
- Update `sw.js` push handler to also send a `{type:'play-sound'}` message to all clients so the existing `playNotificationSound()` fires.
- For background (no client open), the OS notification sound plays by default; ensure `silent: false` on `showNotification`.
- Add explicit short audio play in `RealtimeNotifications.showToast()` so in-app toasts also chime.

## Files to change

- `supabase/functions/fulfill-order/index.ts` — save `gh_reference`
- `public/sw.js` — dedupe push when tab focused, post sound message
- `src/components/global/RealtimeNotifications.tsx` — listen for SW sound message + play sound on every toast
- `src/components/admin/AdminVerifiedTopups.tsx` — add realtime subscription + refetch on focus
- New SQL migration — delete the two accounts and all their data

