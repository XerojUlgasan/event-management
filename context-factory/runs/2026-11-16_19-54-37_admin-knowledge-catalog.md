# Admin knowledge catalog

Started: 2026-11-16T19:54:37+08:00
Updated: 2026-11-16T19:54:37+08:00
Status: complete
Scope: User-authorized admin AI sidebar and knowledge catalog dashboard, with dashboard-design and capability-tier delegation. No re-embedding, assistant retrieval, or hosted deployment.
Checkout: feat/ai at dd9bf62; existing uncommitted ingestion/schema/environment work preserved.
Continues: [Catalog embedding ingestion](2026-11-16_19-11-47_catalog-embedding-ingestion.md)

## Goal

Let administrators inspect indexing coverage, identify incomplete listings, preview knowledge content, and open the source listing.

## Result

Added **AI → Knowledge Catalog** at `/app/ai/knowledge`, admin-only list/detail GET endpoints in Node and Edge, and a shared contract. Global coverage includes every eligible owner, including those without stored rows. Table filters precede pagination and do not change global totals. Details show stored text, authorized photos, expected pending content, and withdrawn chunks excluded from coverage. Source links open exact existing catalog previews.

## Changes or findings

- Reused shared UI controls and AMAC theme tokens. Page-owned KPI composition avoids the existing StatCard's unrelated menu. Existing light-only styling is preserved.
- Shared source hashing keeps coverage compatible with ingestion. Reads use consistent snapshots and perform no reconciliation or provider calls. SQL remains in `data/ai`.
- Stale chunks retain recorded indexing times. Photo status checks source identity and recorded digests without downloading image bytes or proving Storage availability.
- Terra handled backend/frontend implementation; Luna mapped UI reuse; a separate Sol review found issues with stale drawer metadata and hidden withdrawn rows, both fixed and inspected by the lead.

## Decisions

Coverage targets complete indexing of eligible catalog listings. Refresh reloads status only. Pending does not claim failure or active execution. Search is visibly marked disconnected; retry jobs and retrieval remain separate work.

## Verification

Catalog-knowledge suite: 34 passed without skips; navigation/fixture: 6 passed; Edge routing: 3 passed. Workspace checks, web build, Edge build, design ownership, guidance checks/tests, scoped formatting, and diff checks passed. Web build retains a large-chunk advisory. A configured-local-database read-only transaction passed source-loading and coverage invariants. Served Edge rejected an unauthenticated dashboard GET with 401.

Playwright used synthetic API/profile responses against the actual web server. Inspected screenshots at 375/1440/3440 widths and loading, retained-error, empty, tooltip, text/photo/withdrawn-detail states. Known totals matched; phone overflow was fixed. Exact source navigation and Back passed with no page errors. This is separate browser-fixture and database/API proof, not authenticated browser-to-database or hosted proof.

## Remaining work

No required dashboard work remains. Hosted rollout, full-stack authenticated browser verification, durable retry tracking, and assistant retrieval remain unverified or unimplemented as stated above.

## Resume here

Review the scoped dashboard diff and README section before deployment. Start with `KnowledgePage.tsx`, `controllers/ai`, and the dashboard tests; preserve prior ingestion work and separate authorization for provider operations.
