# Index pending knowledge

Started: 2026-11-18T20:58:00+08:00
Updated: 2026-11-18T21:10:22+08:00
Status: complete
Scope: User-authorized Knowledge Catalog button to index pending embeddings for semantic search; no shared database backfill or live provider calls.
Checkout: main at 1157772; unrelated in-progress seed/catalog changes preserved.
Continues: [Admin semantic catalog search](2026-11-16_20-13-00_admin-semantic-catalog-search.md)

## Goal

Let administrators process pending catalog knowledge from the dashboard and verify that indexed chunks become searchable.

## Result

Added **Index pending** beside Refresh, using shared Button, PageHeader, notifications, and existing styles. The page shows progress, refreshes coverage, reports partial failures, and stops scheduling requests when unmounted. Removed the obsolete assistant-disconnected badge after confirming the current assistant search tool.

## Changes or findings

- Admin-only `POST /admin/ai/knowledge/index` accepts an optional scoped continuation cursor. SQL selects at most five eligible owners per request before preparing their content; one missing, pending, stale, or withdrawn chunk is handled per request. Failed chunks advance the cursor and remain retryable on a new pass.
- Reused embedding synchronization, configured model, guarded writes, and freshness assessment. Selection queries have a statement timeout; refresh transactions also bound statement and owner-lock waits. Node and Edge enforce the small JSON body limit.
- Terra implemented backend checks; independent Sol review identified unbounded selection and lock waits, both corrected and re-reviewed without remaining actionable findings.

## Verification

All 44 catalog-knowledge tests and API/web types passed. Tests cover auth, failures/retry, bounded traversal, lock contention, stale content, and semantic retrieval after indexing using a synthetic provider and disposable databases. Node/Edge in-process checks passed 401, 413, and OpenAPI registration. Web and Edge builds passed. Synthetic browser checks covered keyboard activation, pending/disabled controls, success/partial/error feedback, coverage refresh, and React unmount; only one cursor request remained after unmount. Shared reuse audit passed. Existing unrelated thumbnail structure/design violations remain.

## Remaining work

Live provider, authenticated browser-to-runtime, and hosted deployment were not exercised. Concurrent administrators can duplicate provider calls; guarded writes still reject superseded sources. The page must remain open to finish a pass; no durable job was introduced.

## Resume here

Review the scoped diff or use **AI → Knowledge Catalog → Index pending**. Keep completed chunks and rerun the action for remaining failures.
