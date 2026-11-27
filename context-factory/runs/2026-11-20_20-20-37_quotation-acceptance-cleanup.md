# Quotation acceptance cleanup

Started: 2026-11-20T20:12:34+08:00
Updated: 2026-11-20T20:22:00+08:00
Status: complete
Scope: User-authorized removal of quotation acceptance across schema, contracts, API, UI, seeds, tests, current docs, and sketch; local migration and runtime verification; no hosted deployment, commit, or push
Checkout: main at fb4d86ab1c52e3252a94d8de22319235f970a74b; initially clean
Continues: [Booking proposal status implementation](2026-11-19_22-43-07_booking-proposal-status-implementation.md)

## Goal

Retire quotation `accepted` and `accepted_at`/`acceptedAt` while preserving administrator revisions, financial/version/message/audit history, and booking-request acceptance.

## Result

Current quotation states are `draft`, `sent`, and `superseded`. The forward migration is applied to the configured local database and generated Kysely types match it. The rebuilt, restarted Edge runtime serves the new contract.

## Changes or findings

- Migration normalizes accepted offers to sent, or superseded when a sent replacement exists, and discards acceptance timestamps. Local snapshots confirmed quotation, message, audit, and booking data unchanged apart from the removed null column; all 102 local quotations were already outside acceptance.
- Terra handled API/contracts/seeds, Luna current docs/sketch, and the lead migration/frontend/integration. Independent Sol review found no actionable issues. No model substitutions.
- Historical migrations and isolated historical migration tests remain unchanged. Current docs and sketch follow the chat/admin revision flow.

## Decisions

[Retire quotation acceptance](../history/decisions/2026-11-20_retire-quotation-acceptance.md) records authorization and historical-data conversion.

## Verification

Focused API/database suites passed 36/36; web DOM and latest-sent checks passed 29/29; local Edge checks passed 9/9; guidance tests passed 9/9. Schema validation, API/web/UI types, web/Edge builds, lint, environment, guidance links, formatting, and whitespace checks passed. Prisma reports all migrations applied and no schema difference. Browser checks used real components with synthetic data for admin revision, customer chat guidance, keyboard history expansion, and closed-history reads; no fixture writes or browser warnings/errors. Reused existing Badge/Button/FormField/Textarea and theme styles without shared UI changes.

Workspace check stops at two unchanged thumbnail import-boundary failures; design check reports five unchanged thumbnail/CSS issues. Their sources and check scripts match HEAD. No hosted/provider proof is claimed.

## Remaining work

No implementation work remains. Task browser previews, servers, and disposable databases are removed; the user's local Edge service remains running with the rebuilt bundle. Hosted rollout remains outside scope. Shared UI/Storybook was not rebuilt because shared UI source and styles did not change.

## Resume here

Inspect the final diff and evidence above. Hosted rollout requires the matching migration and API/web release; it is outside this task.
