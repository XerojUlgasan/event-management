# Catalog embedding ingestion

Started: 2026-11-16T19:11:47+08:00
Updated: 2026-11-16T19:27:08+08:00
Status: complete
Scope: User-authorized embedding ingestion, automatic refresh and initial backfill, actual uploaded/sample photos plus context, Gemini Embedding 2 at 768 dimensions. Videos and knowledge search are excluded.
Checkout: feat/ai at dd9bf62; pre-existing schema/migration, README, and environment-example work preserved.
Continues: [Catalog knowledge migration](2026-11-16_18-34-43_catalog-knowledge-migration.md)

## Goal

Prepare and embed eligible catalog content, preserve successful catalog saves during provider failures, and reject generation results superseded by edits.

## Result

Implemented ingestion and completed the initial backfill in the configured local Supabase database: 237 ready chunks across 85 catalog packages and 61 services, including 68 photos. A second backfill reported 237 unchanged chunks, zero new embeddings, and zero failures; final checks found no pending or incompatible vectors. Applied only the pending additive catalog-knowledge migration. Text and actual-image provider calls succeeded. No knowledge search or assistant retrieval was added.

## Changes or findings

- Deterministic overviews and original Markdown slices retain pricing, inclusions, section context, and reading order. Each photo uses actual image bytes plus listing/section/alt/caption text. Uploads and samples are included; WebP converts to PNG through portable ImageScript.
- Transactions reconcile source hashes; unchanged inputs retain vectors. Changed rows receive fresh IDs, photo hashes include processed bytes, and guarded stage/save transactions reject stale work. Service rename/archive refreshes dependent package overviews.
- Automatic refresh runs after commit with two active owners per process, 120-second owner and 30-second call limits. The CLI retries pending work without the owner budget.
- Live testing exposed that the local `oneshot` Edge policy drops post-response work. Preserved that policy and enabled bounded waiting through `CATALOG_EMBEDDING_AWAIT=true` in the ignored local Edge environment; selected its embedding model and restarted the function server. Other credential values were untouched. Node/deployed background-capable workers default to background refresh.

## Verification

The 30-test catalog-knowledge suite, five environment tests, 25 catalog tests, API type check, environment ownership check, Edge bundle, guidance navigation, and nine guidance tests passed. Disposable tests cover scope, individual image payloads, WebP conversion, unchanged sample-media replacement, withdrawal, stale writes, missing configuration, provider failure/retry, and awaited local execution.

Actual local Edge HTTP creation returned 201 with three ready chunks, including a photo, for both sample and uploaded WebP fixtures. Temporary packages, media, and sessions were cleaned up. Independent integration review reported no actionable findings; the data module received root review because the reviewer authored its initial version. Initial backfill reported zero failed or superseded chunks. Hosted runtime, deployment, and search quality remain unverified.

A second complete backfill generated zero embeddings, retained all 237 unchanged chunks, and reported zero failures.

## Decisions

See [catalog embedding ingestion](../history/decisions/2026-11-16_catalog-embedding-ingestion.md).

## Remaining work

There are no durable scheduled retries after interruption or provider failure; rerun `pnpm --filter @event-management/api catalog:embed`. Node CLI image reads require Storage configuration; this local backfill supplied credentials transiently from the matching local Supabase status. Hosted rollout remains separate.

## Resume here

Inspect this implementation and the ingestion decision before adding retrieval. Preserve model/preprocessing compatibility, catalog visibility boundaries, and the user's separate authorization for any search tool.
