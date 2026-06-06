## Goal

Right now the app only has General + Agent tiers. You're asking for a **reseller storefront** layer on top of that — same dashboard, but each reseller has their own customer base and their own retail prices. Nothing of this exists yet, so we're building it from scratch.

## What we'll build

### 1. Reseller identity
- New tier value `reseller` added to profiles (sits next to `general` / `agent`).
- Each reseller gets a **sequential code** (`R001`, `R002`, …) stored in `profiles.agent_code`, generated the same way agent codes are today.
- Admin → Users gets a "Make Reseller" action (next to existing Make Agent), which calls a new `admin_set_reseller` RPC that assigns the next free reseller code.

### 2. Customer ↔ reseller link
- New column `profiles.reseller_id uuid` (nullable, references the reseller's user_id).
- When someone opens `https://donmacdatahub.com/?ref=R001` (or `/register?ref=R001`), the code is stored in `localStorage` and used during signup. After signup, an RPC `bind_reseller(p_code)` sets `reseller_id` on their profile.
- On login, if a `?ref=...` is in the URL, the same binding runs (covers "customer searches the main URL and signs in" — they still end up tagged to the right reseller and land on `/dashboard`).
- Already-bound customers are never re-bound (first reseller wins).

### 3. Per-reseller custom prices
- New table `reseller_prices` (`reseller_id`, `network_id`, `bundle_size`, `price`). Reseller sets one price per bundle.
- New page `/reseller` (visible only to tier=reseller) where they edit their prices in a table per network. Defaults pre-filled with current general prices.
- Dashboard pricing logic: when the logged-in user has `reseller_id`, fetch that reseller's prices and use those instead of general/agent prices. Falls back to general price if reseller hasn't set one.

### 4. Profit calculation
- Wholesale cost map already exists in the codebase (used by Admin profit analytics). We extend it so reseller orders compute:
  `profit = order.amount − wholesale_cost(network, bundle)`
- Admin Analytics gets a new **"Reseller profit"** view: per reseller, total customer orders, revenue, wholesale cost, profit.
- The reseller's own dashboard shows their lifetime + today's profit.

### 5. Admin visibility fixes
- Admin → Users already lists every row in `profiles`, so any customer (including those bound to a reseller) will appear — we just add a "Reseller" column showing the reseller's code/name when `reseller_id` is set, plus a filter "Show customers of [reseller]".
- Admin → Resellers tab lists all resellers with: code, name, # customers, total profit, edit prices.

### 6. Signup/login routing
- `?ref=R001` is captured anywhere on the site, persisted, and redirects to `/dashboard` post-auth (today new users land on `/dashboard` already; we just make sure the ref is bound before the redirect).

## Technical details

**Migrations (one migration file):**
- `ALTER TABLE profiles ADD COLUMN reseller_id uuid;` + index.
- `CREATE TABLE reseller_prices (id, reseller_id, network_id, bundle_size, price, created_at, updated_at)` + GRANTs + RLS:
  - Reseller can CRUD their own rows.
  - Authenticated users can SELECT rows where `reseller_id = profiles.reseller_id` of `auth.uid()` (so the dashboard can read their reseller's prices). Admin full access.
- `CREATE TABLE reseller_code_assignments` (mirrors `agent_code_assignments`) for sequential `R001…` codes.
- RPCs (all SECURITY DEFINER):
  - `admin_make_reseller(target_user_id)` — assigns next R-code, sets tier=reseller.
  - `bind_reseller(p_code text)` — sets `reseller_id` on caller's profile if unset.
  - `reseller_set_price(p_network, p_bundle, p_price)` — upsert into reseller_prices.
- Update `protect_profile_fields` trigger to also lock `reseller_id` from being changed by the user directly (only via RPC).

**Frontend:**
- `src/hooks/useRef.ts` — captures `?ref=` and writes to localStorage.
- `Login.tsx` / `Register.tsx` — call `bind_reseller` after auth if a ref is stored.
- `src/hooks/usePricing.ts` — central pricing hook used by `DataBundles.tsx`; returns reseller's prices when applicable.
- `src/pages/Reseller.tsx` — price editor.
- `src/components/admin/AdminResellers.tsx` — admin tab listing resellers, their customers, and profit.
- `src/components/admin/AdminUsers.tsx` — add Reseller column + "Make Reseller" action.
- Sidebar entry "My Storefront" for tier=reseller.

## What this plan does NOT include (flag if you want them)

- Custom subdomain per reseller (e.g. `r001.donmacdatahub.com`). Customers will use the main URL with `?ref=R001`.
- Reseller-branded storefront (logo/colors per reseller). All customers see the standard Donmac UI, just at the reseller's prices.
- Automatic payout of profit to the reseller's wallet on each order. Profit is reported in the dashboard; payouts stay manual unless you ask for auto-credit.
- Reseller fulfilling orders themselves — fulfillment stays via the existing GHDataConnect pipeline.

Reply "go" to build it, or tell me what to change (e.g. "add auto-payout", "add subdomains", "skip the reseller profit page").