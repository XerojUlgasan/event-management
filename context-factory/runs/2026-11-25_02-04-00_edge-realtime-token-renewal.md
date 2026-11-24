# Edge Realtime delivery and token renewal

Started: 2026-11-25T01:58:00+08:00
Updated: 2026-11-25T02:04:00+08:00
Status: complete
Scope: Local Edge configuration, private conversation and notification delivery, and browser verification.
Checkout: `codex/catalog-photo-matches-5da111c` at `04822386` with the SUP_JWT_KEY signer changes in the working tree.
Continues: [Realtime message bubbles](2026-11-21_02-35-00_conversation-realtime.md).

## Result

The running local API returned HTTP 200 for token issuance even when its signing secret differed from the Realtime verifier's secret. A Chromium customer session attempted both private joins without an acknowledgement. Realtime reported signature failures. Updating the local function secret and reloading the function server restored private joins and delivery.

On renewal, the Supabase client also sent a public credential on the joined sockets. The conversation and notification clients now supply a callback that returns the current scoped token for that subscription.

## Verification

Two Chromium sessions used the running website and Edge API. A temporary customer's session had a shortened lifetime to exercise the actual renewal timer. Both private channels joined, fetched new tokens, and rejoined successfully. Socket traces showed no unscoped credential update after the fix.

With recipient thread GETs blocked, an admin reply appeared in the customer's thread in 180 ms. A customer reply appeared in the admin thread in 93 ms, and the database recorded the read receipt. Inserting a test notification for the temporary customer produced a socket frame and a bell announcement within 360 ms. The test removed its temporary chat, account, and sessions.

## Resume here

For a hosted rollout, configure the target project's trusted HS256 secret, deploy the API and web changes, and repeat the two-session delivery and renewal check on its public origin. This run exercised local Edge only.
