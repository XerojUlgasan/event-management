# Combined catalog text

Started: 2026-11-19T21:16:23+08:00
Updated: 2026-11-19T21:20:32+08:00
Status: complete
Scope: User-authorized combined text indexing with independent photos. No application database mutations, live provider calls, commits, or deployment.
Checkout: main at 4131b0d; extensive pre-existing message, queue, search, UI, and documentation changes preserved.
Continues: [Knowledge background indexing](2026-11-19_20-48-44_knowledge-background-indexing.md) and [unique search results](2026-11-19_21-13-26_unique-knowledge-search-results.md).

## Result

Preparation emits exactly one `text` row per eligible package/service, combining listing facts, complete Markdown across sections, and linked-listing captions in existing reading order. Text is not sliced by widget or length. Photos retain their own keys, context and vectors; video remains excluded. The [accepted decision](../history/decisions/2026-11-19_combined-catalog-text.md) supersedes the former text granularity.

Existing freshness assessment withdraws legacy text keys; both searches exclude them. Reconciliation removes them during a save/reindex while unchanged photo embeddings remain reusable. No schema, HTTP shape, UI, or queue policy change was needed. README and seed guidance describe the new format and recovery path.

## Verification

- Tests first reproduced the former widget-based preparation. Final isolated pgvector/synthetic-provider checks: catalog 47 passed, four absent Supabase-role checks skipped; public search and worker/queue 14 passed; package suite 36 passed; seed/rerun integration passed.
- Coverage includes cross-section ordering, Unicode text longer than 6,000 characters without splitting, complete authored seed Markdown, legacy withdrawal/removal, photo-vector retention, stale writes, and owner-job processing. Search deduplication retains pressure from six separate photos.
- API types, generated Edge build, scoped ESLint/Prettier, and whitespace checks passed. A separate Terra review found no actionable issues. Lead inspected source, callers and integrated tests.
- Guidance links/routes and all nine guidance tests passed; applicable TypeScript, AI retrieval, documentation, continuation, and decision-record routing scenarios were walked.

## Remaining work

Gemini Embedding 2 has an 8,192-token input limit. Full text is preserved and submitted, but oversized provider representation and Gateway truncation controls were not verified; no speculative provider option was added. Public search still returns bounded prefix excerpts; details use the existing model-selected detail tool.

## Resume here

Review the scoped diff, then use **Index pending** with matching worker code during an authorized rollout to rebuild existing text vectors. Application reindexing, live provider quality, browser and hosted rollout remain separate. The disposable verification container is stopped after checks.
