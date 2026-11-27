# Booking package details

Started: 2026-11-16T14:32:00+08:00
Updated: 2026-11-16T14:41:10+08:00
Status: complete
Scope: Remove three booking-request package columns and derive details through package_id, keeping callers coherent
Checkout: feat/ai at 4233a5c; initially clean; scoped changes remain uncommitted
Continues: none

## Goal

Remove `package_name`, `package_price`, and `package_max_guests` from booking requests and read those values from the referenced package.

## Result

Migration `20261116063852_derive_booking_package_details` drops only those columns and their dependent checks. It was applied to the configured local database after all earlier migrations were confirmed complete. SQL verified column absence and successful referenced-package reads. No hosted database was changed.

## Changes or findings

- Updated Prisma and regenerated Kysely types from a migrated disposable database.
- Booking DTOs load referenced packages once per batch; message headers and event-day queries join packages directly. Existing HTTP field names remain available.
- Removed snapshot writes from intake, scenario seed, and current test fixtures. Historical migration fixtures retain their original schema.
- Updated current docs and guidance; private proposals and saved quotation amounts retain their separate behavior.

## Decisions

[Current package ownership](../history/decisions/2026-11-16_booking-package-details.md) records the user-directed change and supersedes historical snapshot retention.

## Verification

All 53 integration tests passed across booking requests, event days, packages, messages, quotations, seed, and checklist migration. The event-day suite passed again after adding a rename regression. Populated migration checks preserve remaining booking fields and related history. Workspace checks, Prisma validation, API types, Edge build, and guidance checks passed. The local Edge health endpoint returned OK. The migration/type-generation scratch database was removed. Browser journeys and hosted deployment were not exercised.

## Remaining work

No implementation work remains. Changes are uncommitted; hosted rollout remains separate.

## Resume here

Review the migration and booking response mapper with the scoped diff before any requested commit or deployment. Coordinate hosted API and migration rollout; older API code requires the dropped columns.
