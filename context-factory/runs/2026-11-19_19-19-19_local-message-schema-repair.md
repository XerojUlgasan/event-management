# Local message schema repair

Started: 2026-11-19T19:16:00+08:00
Updated: 2026-11-19T19:19:19+08:00
Status: complete
Scope: Diagnose the user's repeated local Edge message errors, verify the uncommitted feature files, and repair the local integration gap without resetting data or committing changes.
Checkout: main at 4131b0d; preserve the uncommitted image feature and durable refactor.
Continues: [Durable message processing](2026-11-19_18-51-15_durable-message-processing.md)

## Goal

Reproduce the failed message reads against the actual local Edge database and verify the running HTTP path after fixing the cause.

## Result

The running local Supabase database lacked the three image-feature migrations. The real message selection query failed with PostgreSQL `42P01`: relation message_images does not exist. After applying only those reviewed migrations, the query and authenticated HTTP reads passed.

## Changes or findings

- All feature files and the new `apps/api/prisma/migrations/20261119110919_durable_message_processing/migration.sql` already existed in this checkout; new files remain untracked and changes remain unstaged.
- Obtained the local target privately through the existing development worker environment mapping and local Supabase CLI status, rather than assuming the Prisma default target matched Edge.
- Compared disk migrations against completed local Prisma history. The only pending migrations were `20261119031756_message_images`, `20261119035635_track_image_interpretation`, and `20261119110919_durable_message_processing`. Inspected all three before applying them with Prisma against that verified local target.
- No reset, seed, application source change, service restart or hosted operation was performed. The old richer draft migration was not recreated.

## Decisions

The earlier disposable/synthetic checks proved the implementation in isolation but did not prove the user's running stack was ready. A successful build is insufficient when the runtime database lacks the matching migrations. Retain this distinction in future verification reports.

## Verification

- Reproduction command: `pnpm --filter @event-management/api exec tsx /tmp/clemora-local-message-check.ts`. It resolves the actual local Supabase target and executes the real `selectMessageColumnsData` query with no returned message data. Before: `42P01`. After: pass on two executions.
- Authenticated with a documented local customer fixture through `http://localhost:4321/v1`; `/messages/conversations` and `/messages/conversation` each returned HTTP 200 with object responses. Logged out successfully (204) and removed the task-created cookie file/session directory.
- No real vision/text provider calls, image send, browser journey or hosted runtime checks were performed. Existing isolated test results remain recorded in the predecessor.

## Remaining work

Live image upload, worker interpretation and provider response quality are not established by these read checks. Other database targets still need the same migrations before running this code.

## Resume here

Reload the local messages screen. If another failure occurs, inspect its actual request/status and database or worker error code before attributing it to Edge CPU limits. The new runtime schema is applied only to the verified local Supabase target; preserve all uncommitted changes.
