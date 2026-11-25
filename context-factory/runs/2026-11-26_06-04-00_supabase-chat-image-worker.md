# Supabase chat image worker

Started: 2026-11-26T06:04:00+08:00
Updated: 2026-11-26T06:31:00+08:00
Status: complete (local release verification)
Scope: Repair hosted image-message processing. Test locally with the Node worker disabled before publishing to production.
Checkout: `codex/supabase-catalog-rollout` from production `dcc66411`, in the existing `production-worker` room.
Continues: [AMAC reference-photo search](2026-11-24_15-04-19_amac-reference-photo-search.md)

## Result

A dedicated Supabase Cron schedule checks due image-message jobs every five seconds and invokes a private Edge route. The existing catalog schedule keeps its identity. Both reuse the queue's fencing, retry and recovery rules. Deployment probes the two routes before configuring their schedules in one database transaction. Each route has its own Vault signing key.

## Verification

Suspending the isolated room's Node worker reproduced the incident. A photo remained pending through two catalog ticks. Adding the image schedule allowed the same saved message to receive an assistant reply after a real vision call. A signed-in customer submitted a package thumbnail and received a matching recommendation through the authenticated conversation API.

A four-photo test with a 16-megapixel WebP exposed repeated decoding and an Edge CPU limit. Photo search now checks the previously validated original's identity and sends WebP directly to the Gateway. Existing WebP continuation cursors preserve their prior query encoding. The configured Gateway returned distinct 768-dimensional vectors for two different WebPs. Queued photo turns have more time to finish their answer after tool calls. The schedule avoids duplicate requests waiting for dispatch in pg_net. Supabase acknowledges the database claim and runs the handler with `EdgeRuntime.waitUntil`. Two independent messages held live leases, with both HTTP requests acknowledged, before either finished. On the release bundle the four-photo guest job and the signed-in photo job each completed on their first attempt and produced one reply. A catalog job also completed through the same Edge entry point. The Node worker was suspended throughout these checks.

The combined queue, image, catalog and assistant suites passed 153 tests with five opt-in skips. Thirteen Edge checks and four rollout script checks passed. The guidance link checker reported two missing historical proposal-tool paths.

## Resume here

Check the production workflow, named Cron schedules, original queue row, saved image interpretation and linked assistant reply together. See [production worker verification](../workflows/implement/references/development.md#production-supabase-deployment).
