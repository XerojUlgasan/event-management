# Catalog and canvas API ownership

Started: 2026-11-18T00:02:54+08:00
Updated: 2026-11-18T00:07:56+08:00
Status: complete
Scope: Investigate catalog/canvas placement, then apply the user-authorized behavior-preserving API cleanup. No commit, push, deployment, configured application-data writes, or live provider calls.
Checkout: main at 8fac32b; pre-existing uncommitted package-widget, contracts, UI, tests, and documentation changes preserved.
Continues: [Package canvas widget](2026-11-17_23-57-38_package-widget.md)

## Goal

Shorten the mixed canvas implementation and follow the API's existing query, service, and utility ownership rules.

## Result

The former `data/packages/catalog-canvas.ts` mixed queries, hydration, save policies, and pure projections. Shared package/service canvas operations now have explicit owners:

- [Canvas queries](../../apps/api/src/data/catalog-canvas/catalog-canvas-queries.ts) own reads, locks, media-owner lookups, and persistence. Stored JSON validation remains query-result decoding.
- [Read service](../../apps/api/src/services/catalog-canvas/read-catalog-sections.ts) and [replace service](../../apps/api/src/services/catalog-canvas/replace-catalog-sections.ts) own hydration and save rules; surrounding domain transactions remain unchanged.
- [Canvas utilities](../../apps/api/src/utils/catalog-canvas.ts) own media IDs, cover selection, URLs, projections, and stored-widget mapping. Pure catalog cursor parsing moved from data to `utils/catalog-pagination.ts`.
- Title lookup and deletion-reference SQL moved into `data/catalog/`; title formatting/error classification stay in utilities. AI source queries return records, and an AI service hydrates them without a data-to-service dependency.

## Verification

The combined serialized package/schema/migration/quotation/knowledge-preparation/embedding run passed 57/57 tests in disposable local PostgreSQL databases with fake Storage and embedding providers. After moving cursors and extending title-conflict/archived-reference assertions, the package API suite passed 20/20. API type checking, Edge bundling, scoped formatting, guidance checks and nine guidance tests, and diff checks passed. No disposable catalog test databases remained. A source audit found no direct query operations in the 26 inspected catalog service/utility files and no stale imports/symbols. Sol independently reviewed the refactor without actionable findings; comparison of the original dirty canvas relied on the lead's initial source inspection because that full file was not saved separately.

## Remaining work

No required cleanup remains. Browser, served Edge, hosted deployment, and real Storage/provider behavior were not tested for this internal refactor. No schema or contract changes were introduced.

## Resume here

Review the new query/service/utility files and their callers together with the preserved package-widget work. Commit or deploy only when separately requested.
