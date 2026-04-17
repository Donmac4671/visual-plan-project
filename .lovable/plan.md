
## Goal
Fix AirtelTigo Premium failures + deliver true phone-style push notifications with the wording structure you specified, for both users and admin (admin sees ALL user activity).

## 1. AirtelTigo Premium failures

The current `fulfill-order` sends `network: "atpremium"` to GHDataConnect's `/v1/purchaseBundle` endpoint. Per provider rules, AT Premium uses a different network key/endpoint. We will:

- Update `fulfill-order` and the Telegram bot's network map so AT Premium uses GHDataConnect's correct value (`at_premium` / dedicated endpoint per provider docs — verified by hitting `/networks` once at deploy and falling back).
- When the provider returns failure for AT Premium, retry once with the alternate key (`at-premium`, `atpremium`, `at_premium`) before marking failed.
- Refund the wallet automatically when an AT Premium (or any) order fails, instead of only marking it failed (currently funds are kept).
- Log the exact provider error against the order so admin can see why it failed.

## 2. Real phone-style push notifications

Current setup only fires `Notification` while the tab is open. To get WhatsApp/Chrome-style banners that arrive even when the site is closed, we need true Web Push (VAPID + push subscriptions + server send).

Plan:
- Add `push_subscriptions` table (user_id, endpoint, keys, role, created_at) with RLS.
- Generate VAPID keys, store as secrets `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`.
- Upgrade `public/sw.js` to handle `push` events and show notifications with our brand icon + sound + vibration.
- On login, register the SW, request permission, subscribe with the VAPID public key, and upsert the subscription to the DB.
- New edge function `send-push` that takes `(user_ids[] | role, title, body, url)` and sends Web Push to each saved subscription using `web-push` (Deno port).
- New edge function `notifications-dispatcher` triggered by DB webhooks on `orders`, `wallet_topups`, `complaints`, `chat_messages`, `referrals`, `agent_applications`. It builds the message and calls `send-push` for the user and (always) for admin.
- Frontend `RealtimeNotifications.tsx` is simplified to only show in-app toasts when the tab is open; background push is handled by the SW so notifications work even when the site is closed.

## 3. Notification wording (exact structure you asked for)

User (own number):
- Placed: `Your <Network> order of <Package> has been successfully placed and is being processed.`
- Pending: `Your <Network> order of <Package> is pending and will be processed soon.`
- Failed: `Your <Network> order of <Package> failed. Please contact support.`
- Delivered: `Your <Network> <Package> has been successfully delivered.`

Agent OR user buying for someone else (recipient ≠ profile phone):
- Placed: `Your <Network> order of <Package> for <Recipient> has been successfully placed and is being processed.`
- Pending: `Your <Network> order of <Package> for <Recipient> is pending and will be processed soon.`
- Failed: `Your <Network> order of <Package> for <Recipient> failed. Please contact support.`
- Delivered: `Your <Network> <Package> for <Recipient> has been delivered.`

Admin (everything):
- New order, status change, new top-up (MoMo + Paystack), complaint created/replied, new chat message, new referral, new agent application — each as a concise push.

## 4. Files / changes

- DB migration: `push_subscriptions` table + RLS; small index.
- Edge functions: `send-push` (new), `notifications-dispatcher` (new), patch `fulfill-order` (AT Premium retry + refund), patch `telegram-momo` (AT Premium fix).
- Frontend: `public/sw.js` (push handler), `src/lib/notifications.ts` (subscribe helper), `src/components/global/RealtimeNotifications.tsx` (toast-only when visible, no duplicate native call), small hook to register subscription on login.
- Secrets: add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (will request once approved).

## Notes
- iPhone Web Push requires the site to be added to Home Screen (PWA). I'll add a small "Install app" hint for iOS users so notifications work there too.
- Existing duplicate-suppression and 4-second throttle remain.
