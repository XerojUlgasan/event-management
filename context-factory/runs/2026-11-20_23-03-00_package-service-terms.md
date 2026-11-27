# Package service terms and private add-ons

Started: 2026-11-20T23:03:00+08:00
Updated: 2026-11-20T23:14:00+08:00
Status: complete
Scope: Implement package inclusions, local service terms, custom-only JSONB add-ons, editor settings and read projections. Quotations deferred; no commit, hosted migration, or deployment.
Checkout: main at 1c0e54e3bc381a1cbd94af9ca04b631d26c0d8c6; initially clean
Continues: [Hide new package widgets](2026-11-20_22-32-42_hide-package-widget.md)

## Goal

Package service widgets are included in the base package price. Their JSONB stores editable included hours and excess hourly rate. Private custom packages alone have an `addonServices` JSONB list with local pricing. Copy catalog defaults explicitly, preserve legacy reads, and verify save/refetch, authorization and UI behavior.

## Result

Implemented package-owned included terms and custom-only add-ons, with copied defaults, direct settings dialogs, customer previews and consistent AI reads. Quotation source and financial behavior remain unchanged. The migration is prepared and tested in disposable databases; configured/hosted application databases and services were not changed.

## Changes or findings

- Sol owns contracts, API, migration and disposable database checks; Terra owns editor and shared display; lead owns AI projections, docs and integration. Requested models are recorded; execution identity is not exposed.
- Reused the picker, pricing controls, Button, Icon, Dialog, FormField and catalog presentation. Updated strict input/stored schemas, package copy/history projections, reference validation, deletion protection and current documentation.
- Independent Sol review approved after repairing archived-term visibility and contradictory AI instructions. A 390px browser check also prompted a shorter reset label; final review approved that change and the Prisma index representation. No findings remain. React checklist found no additional scoped changes needed. Two review/verification repair cycles were used.

## Decisions

[Package service terms](../history/decisions/2026-11-20_package-service-terms.md) records the approved ownership and defaults policy.

## Verification

API package/migration suites passed 38/38, booking requests 11/11, quotation regressions 19/19, AI source/projection suites 12/12, web catalog SSR/DOM 30/30, and guidance tests 9/9 (119 focused checks). API suites use distinct disposable local PostgreSQL databases, replay migrations and verify persisted HTTP save/refetch, copied terms, unchanged base/global prices, stale writes, ownership, archive/delete protection and old audit reads.

Desktop and 390px browser checks used actual components with synthetic fetch/in-memory saves: explicit defaults, local included/add-on overrides, save/reopen, unchanged base, failed reset feedback and Escape/focus restoration passed. These are UI interaction proof, separate from API/database persistence proof. No live provider calls.

Web/UI type checks, Prisma validation, web/Edge/Storybook builds, lint, environment, guidance navigation and whitespace checks passed. API types stop only at unchanged `tests/guest-chat.test.ts:231` (`PoolClient.processID`). Structure reports two unchanged `use-thumbnail.ts` boundary violations; design reports five unchanged thumbnail/CSS issues. Their files match HEAD. These prevent claiming the aggregate workspace gate passes.

## Remaining work

No implementation work remains. Apply the matching migration before running/releasing the new API/web against an application database. Local/hosted rollout, real-provider behavior and quotation integration are outside this delivery. No commit or push performed.

## Resume here

Review the final diff and migration `20261120120000_package_service_terms`. Browser fixtures and the task-owned Vite server were removed; disposable test databases were cleaned up. Existing application services remain untouched. Preserve deferred quotation scope and coordinate migration/API/web rollout separately.
