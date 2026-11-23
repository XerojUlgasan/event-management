# Business information implementation

Started: 2026-11-21T21:06:32+08:00
Updated: 2026-11-21T22:05:54+08:00
Status: complete
Scope: Persist business information, provide an admin editor and show approved basics in the public footer.
Checkout: main, starting revision 67253d2; initially clean, task changes remain uncommitted.
Continues: none

## Goal

The requested inventory was delivered first. The user initially approved six groups, then explicitly narrowed the UI in the separate simplification thread to ten basics and subsequently chose footer placement. Final scope: business name/introduction, phone/email, Facebook/Instagram, address/map, service areas and one opening-hours field. Preserve saved values and unrelated workflows.

## Result

Admins edit `/app/business-information`; public documents show the same saved basics in the footer. `/about` redirects to `/#business-information`. Empty fields are hidden, optional footer failures do not block pages, and reads time out after three seconds. Admin saves preserve hidden fields, reject stale versions and retain drafts across workspace navigation. Missing-profile recovery opens an empty editor and atomically creates the singleton on first save.

## Changes or findings

- Shared schemas, Prisma migration, generated Kysely types and matching Node/Edge routes provide validated reads and admin-only writes. The singleton uses RLS/revoked client grants, a 2 MiB request cap, row locking for updates and insert-on-conflict for concurrent first saves.
- [UI refinement](2026-11-21_21-21-55_simplify-business-information.md) owns final layout, footer and browser evidence. [Missing-profile recovery](2026-11-21_21-54-30_missing-business-information.md) records later first-save changes, which were preserved and audited.
- Terra medium explorers and Composer 2.5 standard implementers were requested; independent Grok high reviews were used. Execution-model metadata was unavailable; no substitutions.
- Initial review's lost-draft finding was repaired by retaining the hidden editor in the account-keyed workspace. The successor repaired three footer CSS findings in one cycle and received final approval. The redundant scoped draft reviewer was cancelled with terminal interrupted status.
- Fresh independent review 3346436d-c263-4c0e-a286-67116491861e approved the later nullable-timestamp/first-save delta with no actionable findings. Final file fingerprints match the checked artifact. Footer CSS matches approved SHA-256 `132bf840343ff5ef9febf5b2d59c24ffb755f5fc323caf034494a6052c177337`.

## Verification

Passed: 14 API/database tests, 16 current UI/helper/footer DOM/SSR tests, eight navigation tests, three RLS tests, Prisma validation, Edge bundle, web check/build, full lint, environment checks and nine guidance tests. API tests use disposable local migrated databases and verify persistence, permissions and concurrent winners. UI/browser/HTTP/synthetic failure and responsive rendering evidence is detailed in the successors; mock remounts are distinguished from real database readback.

Full checks retain unchanged catalog utility-boundary/design issues and a guest-chat PoolClient.processID type error. Hosted rollout and live browser persistence were not proven by this run. No shared migration, business-data write, commit, push or deployment was performed by this lead. Concurrent AI retrieval work is outside this run and was preserved.

## Remaining work

None within the revised implementation scope. Release and hosted verification remain separate.

## Resume here

Review the combined local diff before release. Preserve the ten-field/footer direction, missing-row recovery and concurrent work. All delegates started by this run are terminal. Do not restore the superseded six-group UI or separate page.
