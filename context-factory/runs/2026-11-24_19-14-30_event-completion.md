# Event completion

Started: 2026-11-24T18:48:00+08:00
Updated: 2026-11-24T19:14:30+08:00
Status: complete
Scope: Implement, verify, and commit in the assigned T3 worktree. Integration requires explicit authorization.
Checkout: `codex/event-completion` based on `84c7c5d53ba5954677191de0db7718bee5b1de11`. Verified feature commit `4ec65df0bbcf8e8f8da14bbee3e512a0eae1332f`.
Continues: none

## Result

The worker marks eligible events ready and creates admin alerts. An admin finishes the event on the booking details page. The booking owner receives an alert and sees the event under Finished events using the confirmation date. Schedule edits clear readiness. Linked cancelled days resolve their requested slots if another live day remains. Ready alerts are saved once per recipient per event, even when readiness is restored. [Event completion rules](../business/event-days.md#event-completion)

## Verification

- Isolated Supabase project `clemora-event-completion` used Postgres at `127.0.0.1:57472`, Edge at `http://127.0.0.1:57471/functions/v1/api/v1`, and the built Astro website at `http://127.77.0.47:4347`. Prisma reported 96 applied migrations, including [event completion](../../apps/api/prisma/migrations/20261124120100_event_completion/migration.sql).
- The final Edge build and supervised worker used the migrated database. With the browser closed, the final fixture ended at `11:13:34.257Z` and readiness committed at `11:14:20.267Z` with two admin alerts. Chromium opened the alert and clicked **Mark as finished**. Postgres recorded the actor and `11:14:28.844Z` with one customer alert. Admin and customer views survived reload. Mobile My events placed a finished event with a cancelled future date under Finished events.
- Edge and SQL checks covered moved, cancelled, missing and unresolved schedules, legacy overnight timing, customer authorization, stale and concurrent requests, re-readiness without duplicate alerts, and downtime catch-up. Three focused [API tests](../../apps/api/tests/event-completion.test.ts) also proved the inclusive microsecond boundary and rollback when alert inserts fail. Existing API suites passed 75 checks and web timeline/history passed 12.
- Independent review, scoped lint, API/web types and builds, Prisma validation, guidance tests, web structure and environment checks passed. Baseline diagnostics remain in README table formatting, two historical proposal links, and a message-image CSS token check. Notification bell delivery was verified through persisted API records and UI. Hosted behavior and live Realtime transport were outside this run.

## Resume here

Use the isolated site with local admin and customer accounts. Submit a request, save times, accept and schedule it, then close both workspaces until the final end passes and the worker ticks. Open the admin bell and finish it. Open the customer's alert and reload My events. For deployment order and worker startup, see [migration impact](../../README.md#migration-impact). Await the merge slot before changing the integration checkout.
