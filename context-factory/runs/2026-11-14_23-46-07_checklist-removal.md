# Checklist removal

Started: 2026-11-14T23:46:07+08:00
Updated: 2026-11-14T23:46:07+08:00
Status: complete
Scope: Remove event checklists entirely; investigate dependencies, implement, delegate, and verify. Local code and disposable-database proof only; no shared-data migration, commit, push, or deployment.
Checkout: main at 3b7c973eeffa837cb1bed3c528fdec3e2c328fde, extending the prior uncommitted cleanup. Unrelated TRANSCRIPTION.md preserved.
Continues: [Venue catalog and staff removal](2026-11-14_23-28-10_catalog-staff-removal.md)

## Goal

Remove the checklist feature in addition to venues and staffing, while preserving customer requests, quotations, conversations, and admin event scheduling.

## Result

Removed checklist UI, API operations, services, data modules, contract export, special request-body caps, schema model, generated types, and mock task/progress widgets. Current product and contributor documents describe scheduling without checklists. Seeds already excluded checklist rows and retain operational days.

## Changes or findings

- Prisma generated `20261114154206_remove_event_checklists`; the transactional migration drops the table and SQL-owned content validator without cascading into schedules or users.
- New migration coverage starts with populated checklists and compares booking, requested-day links, original/replacement schedules, and status history before/after removal.
- The earlier catalog/staff migration test stops at its historical checkpoint; later removal does not invalidate its intermediate assertions.

## Decisions

The user's follow-up supersedes the preceding private-checklist decision. Applying the new migration removes saved tasks and progress. Historical migrations, interviews, and runs remain evidence; scheduling and customer/admin communication remain supported.

## Verification

57 API tests passed, including migration, scheduling/movement/cancellation, Node/Edge contract and missing-route checks, seeds, packages, quotations, and messages. Nineteen relevant web tests passed. Prisma validation, workspace types, production/Edge builds, design/structure, formatting, guidance checks and nine guidance tests passed. Sol independently reviewed with no actionable findings; Terra owned frontend removal and Luna current docs.

Isolated browser checks verified three remaining booking tabs, scheduling and reload persistence, mobile layout without horizontal overflow, and removal of mock Operations tasks. Temporary fixture session, servers, and PostgreSQL were cleaned up. No hosted deployment or actual Edge-runtime execution was tested.

## Remaining work

No requested local implementation remains. Cleanup is uncommitted and unpushed; the migration has only run on disposable PostgreSQL.

## Resume here

Review the combined local diff and both additive migrations before separately authorized publication or application-database migration.
