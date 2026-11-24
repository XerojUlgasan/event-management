# Event completion on main

Started: 2026-11-24T19:21:49+08:00
Updated: 2026-11-24T19:29:40+08:00
Status: complete
Scope: Authorized local integration, additive migration, and runtime verification.
Checkout: `/home/zxero/Documents/projects/event_management_v2` on `main`. Merge `1dbc1000aebb7260a5604cf24ad646b46b810d30` contains reviewed tip `005901a352c1a7c0f7f505eb0aa213beda63411d`. Reset edits and untracked SQL matched their preflight patch ID and checksum immediately after merging. Unrelated catalog edits made later were preserved.
Continues: [Isolated event completion verification](2026-11-24_19-14-30_event-completion.md)

## Runtime

The website at `http://localhost:4321` proxies to the `clemora` Supabase Edge gateway at `127.0.0.1:54321`. Edge and the worker use the root Postgres instance at local port `54322`. The database reported 95 applied migrations before `pnpm db:deploy` applied [event completion](../../apps/api/prisma/migrations/20261124120100_event_completion/migration.sql). The total is 96. After `pnpm build:edge`, the active Edge API exposed the new contract and the website loaded the finish action before the supervised worker restarted. The first sweep persisted readiness for 15 of 19 due candidates and 90 seed alerts.

## Verification

- A fresh event ended at `11:28:28.682Z`. The worker persisted readiness at `11:28:32.990Z` with the QA browser closed. Edge denied customer confirmation with 403. An admin clicked **Mark as finished** in Chromium. Postgres saved the admin and `11:28:42.964Z`. Concurrent replay preserved the audit and single customer alert. Both views still showed Finished after reload.
- WebSocket captures showed successful private channel joins and live Broadcasts. The open customer bell updated after confirmation. For a second event, the open admin bell updated after the `11:29:32.976Z` worker tick. Scoped QA accounts, bookings, and alerts were removed. The 15 seeded readiness rows and 90 alerts remain.
- API and web type checks passed. API `tsx --test tests/event-completion.test.ts` and `test:event-days`, `test:notifications`, `test:background-jobs`, `test:edge`, and `test:rls` passed 40 checks. Web timeline and admin history passed 12. Guidance tests, web structure, and environment checks passed. Existing guidance-link and CSS token diagnostics persist. Hosted behavior remains outside this verification.

## Resume here

At the local website, submit a booking as a customer, save its times, and accept and schedule it as an admin. After the final end and a worker tick, open the admin alert and finish the event. Keep the customer bell open to see live delivery, then open the alert and reload My events.
