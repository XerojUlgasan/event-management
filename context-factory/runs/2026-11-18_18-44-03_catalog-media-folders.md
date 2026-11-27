# Catalog media owner folders

Started: 2026-11-18T18:29:15+08:00
Updated: 2026-11-18T18:49:24+08:00
Status: complete
Scope: Implement user-approved storage folder structure for new uploads and saves; no existing-file backfill, schema addition, production deployment, bulk deletion, or reset.
Checkout: main at c2bafdb; initially clean working tree
Continues: none

## Goal

Use one private bucket with pending, package, service, and booking-owned custom-package folders; preserve media URLs and permissions, independent copies, stable IDs, and verification of success/failure paths.

## Result

New uploads use pending paths with MIME-based extensions. After a successful owner save, promotion copies bytes, switches the stored key, then removes the pending object. Failed copies retain the readable source. Existing legacy keys are ignored. Dedicated thumbnails follow owner folders and cleanup, and custom copies receive independent media IDs. Readers refresh a moved key on a recognized Storage missing-object response. Photo freshness uses immutable IDs rather than storage location.

## Decisions

The user clarified that the project was in development at the time and existing development documents need no migration/preservation. The final change has no move-tracking table or schema migration. See the [decision](../history/decisions/2026-11-18_catalog-media-folders.md) and current [media reference](../areas/api/references/external-image-urls.md).

## Verification

All 71 focused tests passed in serialized local runs: 33 package/canvas/thumbnail tests, plus 38 AI image/freshness/search, seed, and quotation regressions. They cover exact owner paths, independent custom thumbnails, unauthorized reads, byte ranges, copy/deletion failure retries, stale saves, and GET races using both plain 404 and Supabase NoSuchKey HTTP 400 responses. The failed initial custom-thumbnail read assertion exposed a missing thumbnail permission reference; the corrected owner queries passed the complete package suite.

The simplified flow also passed real local Supabase Storage upload, package promotion, API streaming, and deletion using synthetic fixtures in a disposable database. All fixtures and the task-created database/script were removed; the configured bucket retained its original 31-object count. The application database has no move-tracking table, and Prisma schema/generated types have no final diff. No existing files were relocated.

Final API type checking, Edge bundling, scoped Prettier, guidance navigation checks, all nine guidance tests, and diff checks passed. Sol independently reviewed the final flow and thumbnail permission/cleanup changes with no actionable findings. Full workspace `pnpm check` is blocked by pre-existing React/data imports in `apps/web/src/lib/utils/catalog/use-thumbnail.ts`, which this task does not modify. Browser, served Edge, hosted deployment, and paid AI provider behavior were not tested.

## Remaining work

No required implementation work remains. Review/commit/deployment are separate actions. The documented development-only crash/rollback orphan limitation remains accepted; there is no durable recovery queue.

## Resume here

Review the scoped diff starting with `apps/api/src/utils/catalog-media-paths.ts` and `services/catalog-media/promote-catalog-media.ts`. Preserve the user's no-backfill/no-new-table scope; use the current media reference for lifecycle behavior.
