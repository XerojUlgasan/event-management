# Admin semantic catalog search

Started: 2026-11-16T20:03:00+08:00
Updated: 2026-11-16T20:13:00+08:00
Status: complete
Scope: User-authorized admin search using existing embeddings, all eligible knowledge text/photos, catalog packages only; no customer assistant integration or reindexing.
Checkout: feat/ai at dd9bf62; pre-existing uncommitted dashboard, ingestion, schema, and environment work preserved.
Continues: [Admin knowledge catalog](2026-11-16_19-54-37_admin-knowledge-catalog.md)

## Goal

Let administrators submit their own queries and inspect ranked catalog knowledge results.

## Result

Added an explicit-submit **Search knowledge** panel and admin-only `POST /admin/ai/knowledge/search`. Queries use the existing Gemini Embedding 2 model and normalized 768-dimensional space. Results include matched text/photos, source listings, similarity scores, and exact preview links. Existing listing-name filters remain separate.

## Changes or findings

- Reused shared Button, SearchField, Panel, CatalogMarkdown, notifications, contracts, media helpers, and theme tokens. App-owned search state rejects outdated responses after edits or unmounts.
- Server checks source freshness in a consistent snapshot and independently excludes custom/archived owners and incompatible embeddings. Pending, stale, and withdrawn chunks cannot appear. Provider/configuration errors return sanitized 503 responses.
- Terra implemented API and UI separately; independent Sol review found no actionable issues. Lead inspected integration and verification.

## Decisions

Admin search includes unpublished catalog listings and returns the top 20 current indexed chunks without an arbitrary relevance cutoff. Scores are vector similarity, not confidence. Query formatting uses Google's search-task prefix without changing ingestion. Exact scans are adequate for the current catalog; revisit ranking/query cost as it grows. No new schema or migration.

## Verification

Workspace checks, web/Edge builds, and 41 focused API/embedding/migration/route tests passed without skips. Browser tests with synthetic API/profile responses passed explicit submit, safe Markdown, text/photo rendering, empty/error states, late-response suppression, source navigation, and 375/1440/3440 overflow checks. Rendered desktop and phone results were inspected. A live embedding query against the configured local database with read-only transactions returned 20 ranked results: 8 text and 12 photos. Served Edge rejected unauthenticated search with 401.

## Remaining work

Authenticated browser-to-Edge/provider proof and hosted rollout were not performed. Photo freshness retains the dashboard's immutable-media assumption. Web build retains its existing large-chunk advisory.

## Resume here

Open `/app/ai/knowledge` as an administrator and submit a query in **Search knowledge**. Review `KnowledgeSearch.tsx` and `search-catalog-knowledge.ts` when extending diagnostics; customer assistant retrieval remains separate.
