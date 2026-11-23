# Remove package service assignments

Started: 2026-11-18T20:12:43+08:00
Updated: 2026-11-18T20:23:00+08:00
Status: complete
Scope: User-authorized removal of `package_services` and active code remnants; preserve linked canvas widgets. Local migration and verification authorized; no commit, push, or hosted deployment requested.
Checkout: main at 4107b13; initially clean.
Continues: none

## Goal

Remove the separate included/optional assignment feature so its schema, contracts, UI, AI behavior, and current documentation no longer conflict with linked canvas widgets.

## Result

The table is removed locally and from the Prisma/Kysely schema. Shared package contracts and API requests/responses have no `services` field; old payloads reject. Package/private-package saves and displays, AI sources and invalidation, obsolete CSS, and the incompatible one-time versioned-demo cleanup script are cleaned up. Service/package widgets retain their existing owner JSONB persistence and current-detail previews.

## Decisions

The [removal decision](../history/decisions/2026-11-18_remove-package-service-assignments.md) records user authority, discarded assignment rows, and deployment requirements. Historical migrations and audit metadata remain; earlier decisions are marked partially superseded. Current README, database, seed, and QA guidance are updated.

## Verification

- Prisma generated the forward migration against a disposable database; full migration replay and `db:generate` produced only the expected table/type removal. Prisma schema validation passed.
- 85 serialized API/migration/AI tests, 21 web catalog tests, eight live Edge checks, and nine guidance tests passed. Production and Edge builds, API/UI/web type checks, guidance navigation, and diff checks passed.
- The populated migration regression preserves canvases, prices, bookings, quotations, audit history, and media while removing assignments and only affected derived overview chunks. Applying the single pending migration locally confirmed table absence and unchanged source-record fingerprints. Live Edge OpenAPI/package responses omit the removed field.
- Isolated browser component fixture verified private-package details without assignment controls, working service picker, and save output without `services`, retaining two linked widgets and the price. This is synthetic browser evidence; database/API behavior is proved separately. Screenshot retained outside the repo.
- Terra agents owned separate backend, frontend, and AI paths. Independent Sol review found one stale QA example, corrected and rechecked, with no remaining actionable findings.

## Remaining work

No required cleanup remains. Aggregate `pnpm check` stops on existing import-boundary issues in untouched `use-thumbnail.ts`; design checks flag untouched `ThumbnailField.tsx` and `package-editor.css`. Initial live Edge checks returned gateway 502s during bundle replacement; health recovered and all eight checks passed on retry. No hosted or live-provider proof claimed. Task databases and browser fixture server/tab were cleaned up.

## Resume here

Review the uncommitted diff and migration before publishing. Deploy matching API/frontend with the migration. On environments with old assignments, affected overview chunks remain pending until a catalog save or the provider-backed `catalog:embed` workflow rebuilds them.
