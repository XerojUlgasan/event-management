# AI file separation

Started: 2026-11-16T20:52:19+08:00
Updated: 2026-11-16T20:52:19+08:00
Status: complete
Scope: User-approved behavior-preserving refactor after read-only investigation; no schema, provider, deployment, or product changes.
Checkout: feat/ai at c8f174b; clean initial tree, refactor left uncommitted.
Continues: [Knowledge search rows](2026-11-16_20-27-00_knowledge-search-rows.md)

## Goal

Follow existing layer/domain/operation conventions to make AI code readable without changing behavior.

## Result

Split the knowledge data monolith into operation files and shared owner/database types. Admin list/detail services now have separate files. Shared source loading, freshness assessment, and hashing have purpose-named service owners; semantic search uses these rather than a dashboard builder. Catalog preparation, synchronization, refresh, and its separate scheduler live under `services/ai/workflows/`. Provider/search adapters remain in `retrieval/`.

`KnowledgePage.tsx` decreased from 501 to 227 lines by extracting `KnowledgeDetailDrawer`, `KnowledgeMetrics`, and cohesive `KnowledgeDisplay` helpers. Existing UI exports, contracts, markup, CSS, request guards, and pagination remain in use.

## Changes or findings

- Updated all callers and test imports; removed old files and an unused alias rather than retaining forwarding barrels.
- Updated the current AI structure reference and repaired historical source links without changing recorded decisions. Product behavior and README implementation claims remain unchanged.
- Terra handled UI extraction and independent review; Luna split data queries. The lead integrated services, callers, and verification. Review compared extracted backend function bodies against the original revision and found no actionable regressions.

## Decisions

Follow the [AI structure owner](../areas/ai/references/structure-and-naming.md). Keep test-file cleanup separate from this refactor.

## Verification

Passed workspace checks, design ownership, web/API and Edge builds, scoped formatting, guidance checks and nine guidance tests. The serial focused run passed 54 tests covering assistant turns, ingestion, dashboard/search, migration/access, and Edge route matching; synthetic knowledge fixture passed separately. A baseline concurrent search run hit asynchronous database teardown activity after its cases passed; its isolated rerun and final serial run passed.

Synthetic browser inspection verified rendered metrics, text/photo drawer content, next/previous pages, withdrawn content, dismissal/focus restoration, attention filtering, retained errors, retry, and recovery. The normal browser session was signed out. This establishes fixture UI behavior, not authenticated full-stack or hosted-provider behavior. The existing web bundle-size advisory remains.

## Remaining work

No required refactor work remains. No live provider calls or hosted rollout performed.

## Resume here

Review the uncommitted diff, beginning with `services/ai/`, `data/ai/`, and the admin AI components. Use disposable fixture suites for further refactors; deployment and real embedding runs remain separate actions.
