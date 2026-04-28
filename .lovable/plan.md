I checked the latest failed AT Premium order and the backend logs. The failure is real and the cause is clear:

- Order `DMH822` was sent to GHData at `2026-04-28 21:19 UTC`.
- The fulfillment function tried every current AT Premium network key:
  - `AT_PREMIUM`
  - `AT-PREMIUM`
  - `AIRTELTIGO_PREMIUM`
  - `AIRTELTIGOPREMIUM`
  - `atpremium`
  - `at_premium`
  - `at-premium`
  - `airteltigo_premium`
  - `airteltigopremium`
- GHData rejected all of them with: `Validation failed: The selected network is invalid.`

So this is not a frontend issue. The app is sending the request, but the provider no longer accepts the AT Premium network values currently coded.

## Plan to fix properly

### 1. Stop marking AT Premium as permanently failed on provider network validation
For AT Premium only, if GHData returns `The selected network is invalid`, the order should not be marked `failed` and refunded immediately.

Instead, it should be marked `waiting` with its local reference saved. This prevents the app from wrongly treating a customer order as failed when it may need manual/provider-side action.

Result:
- Customer payment stays recorded.
- Order remains visible as needing attention.
- No accidental refund while you manually fulfill.
- Admin can later mark it completed/delivered.

### 2. Add stronger diagnostics to `fulfill-order`
Update `supabase/functions/fulfill-order/index.ts` so failed provider attempts return/store clearer information in logs:

- network attempted
- payload shape used
- GHData HTTP status
- GHData validation errors
- final decision: `waiting` vs `failed`

This makes the next provider issue traceable immediately instead of guessing.

### 3. Test AT Premium with the real deployed backend using the known failed order
After changing the function, deploy it and call it against a safe test path/order flow where possible.

For the recent order `DMH822`, since you already manually fulfilled and changed it to completed, I will not re-send that exact order to GHData. I will use it only for log verification and avoid duplicate fulfillment.

### 4. Try to discover the correct GHData AT Premium key without risking user orders
Add a small admin-only diagnostic mode to the fulfillment function or a separate admin diagnostic function that can test candidate network keys without changing the order status unless GHData accepts one.

Candidate additions to test/include will cover likely provider labels such as:

```text
at
AT
airteltigo
AIRTELTIGO
bigtime
premium
AT_PREMIUM_BUNDLE
AIRTELTIGO_PREMIUM_BUNDLE
```

If GHData only validates network names during a real purchase, the safe fallback from step 1 still prevents customer damage.

### 5. Update Telegram ordering too
The Telegram bot has its own GHData network-key list for AT Premium. I will update it with the same safer behavior and network mapping logic so AT Premium does not fail in one channel while the web checkout is fixed in another.

Files involved:
- `supabase/functions/fulfill-order/index.ts`
- `supabase/functions/telegram-momo/index.ts`
- optionally `supabase/functions/process-pending-orders/index.ts` if its retry behavior needs to respect the new waiting state

### 6. Add admin-visible handling for `waiting`
The admin orders table already supports status changes and has a status value `waiting` in backend functions. I will confirm the UI clearly shows `waiting` orders so you can see AT Premium orders that need manual attention instead of hunting for failed/completed edits.

### 7. Deploy and verify logs
After implementation, I will deploy the changed backend functions and check the live logs. The target result is:

```text
AT Premium provider network validation error -> order status waiting, not failed/refunded
Valid provider success -> order status completed for AT Premium
Other genuine provider failures -> failed/refunded only when appropriate
```

## Important note
The current evidence shows GHData rejected the AT Premium network names, not that the customer order creation failed. I will fix the app so this cannot keep causing false failed/refunded orders, and I will make the provider mapping easier to correct once the accepted GHData AT Premium key is confirmed.