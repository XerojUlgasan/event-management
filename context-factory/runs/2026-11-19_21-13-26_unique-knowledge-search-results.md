# Unique Knowledge Catalog search results

Started: 2026-11-19T21:10:53+08:00
Updated: 2026-11-19T21:14:23+08:00
Status: complete
Scope: User-authorized implementation of listing grouping in admin semantic search. No application database changes, live provider calls, commits, or deployment.
Checkout: main at 4131b0d; extensive pre-existing message, queue, UI, and documentation changes preserved.
Continues: [Knowledge search rows](2026-11-16_20-27-00_knowledge-search-rows.md); [background indexing](2026-11-19_20-48-44_knowledge-background-indexing.md) retains the separate queue behavior.

## Goal

Return at most five unique listings from Knowledge Catalog search, retaining each listing's highest-scoring eligible chunk. Multiple widgets remain separate indexed chunks.

## Result

The admin retrieval service checks current-source eligibility, groups ranked candidates by listing kind and ID, and stops after five unique owners. A stale high-scoring chunk cannot suppress a valid lower-scoring match. Package and service IDs remain distinct even when their UUIDs match. The response fields, thumbnail and preview consumers, underlying corpus, queue, and separate public AI search tool are preserved. The root README describes the new result semantics.

## Verification

- Terra implemented the service and HTTP regression assertions; the lead inspected the diff and strengthened the stale-first fixture. A separate Terra source review found no actionable issues.
- Tests-only regression reproduced duplicate chunk results before the service fix. Final catalog suite: 46 passed, four Supabase-role checks skipped because those roles were absent. Public AI-search regression: four passed. All database fixtures used a separate disposable pgvector container and synthetic providers.
- Cases cover repeated top chunks filling the old limit, best eligible photo/text fallback, fewer than five owners, same UUID across kinds, and unchanged knowledge-row count.
- API types, generated Edge build, scoped ESLint/Prettier, and whitespace passed. An initial HTTP test import failed because the fixture password was empty; the corrected isolated configuration passed the full suite.
- Guidance navigation and all nine guidance tests passed. Applicable TypeScript, retrieval, documentation, and continuation routing scenarios were inspected. The disposable container was stopped after verification.

## Remaining work

No implementation work remains. Browser interaction, live provider quality, and hosted deployment were not tested. No migration or reindex is required for this change.

## Resume here

Review the scoped service/test diff and deploy the matching API or rebuilt Edge bundle through the normal authorized rollout. The current UI consumes the same response shape.
