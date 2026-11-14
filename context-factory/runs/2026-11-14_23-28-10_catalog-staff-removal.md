# Venue catalog and staff removal

Started: 2026-11-14T23:11:06+08:00
Updated: 2026-11-14T23:33:24+08:00
Status: complete
Scope: Merge PR #26, pull main, and finish removing venue catalog and staff functionality. Local code, additive migration, tests, and current documentation; no shared-data migration or deployment.
Checkout: main at 3b7c973eeffa837cb1bed3c528fdec3e2c328fde; cleanup changes remain uncommitted. Preserve unrelated untracked TRANSCRIPTION.md.
Continues: none

## Goal

Remove the remaining features after PR #26 without losing customer inquiries, catalog packages/services, account identities, or admin planning.

## Result

PR #26 is merged and local main was fast-forwarded. Only customer/admin roles remain. Customers replace the staff directory. Availability, assignments, coordinator handoffs, delivery actions, deadline policy, and venue catalog surfaces are removed.

## Changes or findings

- The Prisma-generated `20261114151517_complete_catalog_staff_removal` migration revokes obsolete sessions, converts staff and previously undesignated admins to customers, drops job-title/delivery columns, deletes orphan venue canvases, and restores exact package/service ownership. Shared media and task/history records remain.
- Admin scheduling creates and links ready requested dates transactionally, checking acceptance, revision, timezone, and duplicate prevention. Private checklists retain tasks and progress.
- Regenerated Kysely types from disposable PostgreSQL; repaired seed catalog counts/operational-day registration and removed stale tests, styles, contracts, and current documentation. Replaced shared Storybook staff examples with customer workflows.

## Decisions

The user's removal instruction supersedes older staffing/catalog rules. Physical event locations remain valid. Existing designated admins keep admin access; removed staff titles never grant it. Admin event-day planning and private checklists remain.

## Verification

53 API behavior tests; 14 auth tests with local Firebase emulator; migration/password/pagination regression checks and explicit anon/authenticated RLS checks passed. Six web query/navigation and eight catalog SSR tests passed. Types, production/Edge/Storybook builds, structure/design, guidance checks, nine guidance tests, formatting, and diff checks passed. Sol independently reviewed the consequential diff with no actionable findings; Terra implemented frontend/test cleanup and Luna synchronized current docs and Storybook examples.

Isolated browser proof covered Customers, requested-day scheduling, checklist creation/completion/reload, mobile navigation, and package/service-only catalogs at desktop and 390px. Temporary sessions/services were closed. No hosted provider or current Edge-runtime execution was tested.

## Remaining work

No requested local cleanup remains. The new migration is tested only in disposable PostgreSQL and must accompany deployment. Cleanup is not committed or pushed.

## Resume here

Review the local diff and migration before any separately authorized commit/deployment. Existing historical migrations and run records intentionally retain the removed feature's history.
