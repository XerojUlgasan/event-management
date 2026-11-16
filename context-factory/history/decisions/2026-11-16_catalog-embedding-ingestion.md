# Catalog embedding ingestion

Date: 2026-11-16
Status: accepted
Authority: User authorized ingestion only, automatic refresh after catalog changes, backfill, actual uploaded/sample photos with context, `google/gemini-embedding-2`, and 768 dimensions; videos and search are excluded.
Implementation: Ingestion implemented and verified against the configured local database, live provider, and local Edge runtime. Hosted deployment remains separate; dated evidence is in the linked run.

## Problem

Populate the existing catalog corpus from current package/service content without introducing another authority for catalog facts or delaying catalog transactions on provider calls.

## Decision

Extend the [storage decision](2026-11-16_catalog-knowledge-storage.md) using its existing table. Ingest non-archived catalog packages and all non-archived services, including standalone services. Exclude private custom packages and customer, inquiry, quotation, and conversation records. Publishing is not an extra ingestion filter; future retrieval must enforce its own visibility policy.

Prepare overview chunks, original Markdown slices of at most 6,000 Unicode code points per widget, and individual photo chunks. Retain listing/section context and photo alt text/caption. Send actual uploaded and allowlisted checked-in sample bytes with photo context, converting WebP to PNG through `imagescript`; skip video. Use `google/gemini-embedding-2` with normalized 768-dimensional vectors and versioned preprocessing.

Reconcile rows inside existing catalog transactions, with no provider or Storage reads there. Preserve matching source hashes; replace changed rows with new IDs and remove withdrawn chunks. Final hashes also include actual embedding input bytes. Before staging and saving, workers lock and reconcile fresh source, then compare row ID and hash so unfinished work cannot restore superseded content. Service rename/archive invalidates dependent package overviews.

After commit, coalesce owner refreshes and run at most two owners per process. Background owners have a 120-second budget, with 30-second Storage/provider limits. Register Edge tasks with `EdgeRuntime.waitUntil`. The repository local runtime uses `oneshot`, which stops background work after the response; `CATALOG_EMBEDDING_AWAIT=true` makes local mutations wait for refresh after commit, with a 110-second batch budget. Node and deployed background-capable workers keep the default false setting. Recover failures, interruption, or shutdown by rerunning the sequential `pnpm --filter @event-management/api catalog:embed` command, which reconciles eligible sources and retries pending embeddings without the background owner budget.

The existing local Edge `oneshot` policy terminates background work after the response. Preserve that policy because the prior `per_worker` configuration exhausted local resources. With `CATALOG_EMBEDDING_AWAIT=true`, local catalog mutations wait after commit for a bounded 110-second refresh batch. The default remains background execution for Node and compatible deployed workers. This changes local response latency without extending database transactions or rolling back catalog saves on provider failure.

## Alternatives considered

- Provider calls inside catalog transactions hold database locks during external waits and couple catalog saves to provider availability.
- Additional job/document/model tables introduce durable scheduling and ownership beyond this accepted one-table slice.
- Description-only photo vectors omit the actual visual content requested by the user.

## Consequences

Pending rows survive failed calls, but background execution has no durable scheduled retry guarantee. Multiple processes can duplicate provider calls; guarded writes protect persisted state rather than globally deduplicating spend. Model, dimensions, or preprocessing changes require a coordinated reindex. Search, retrieval tools, assistant grounding, and booking commitments remain outside this implementation.

Credentials remain server-only through the API environment owner: Node uses `apps/api/.env`; local Edge uses `apps/supabase/.env.functions`. Configuration and migration authoring do not prove deployment, Storage access, provider access, or actual ingestion success.

## References

- [Current implementation and setup](../../../README.md#current-implementation)
- [AI knowledge standards](../../areas/ai/references/standards-and-verification.md#retrieval-and-knowledge)
- [Ingestion run](../../runs/2026-11-16_19-11-47_catalog-embedding-ingestion.md)
- [Refresh service](../../../apps/api/src/services/ai/workflows/refresh-catalog-embeddings.ts)
- [Owner locking](../../../apps/api/src/data/ai/lock-catalog-knowledge-owner.ts) and [guarded embedding writes](../../../apps/api/src/data/ai/save-catalog-knowledge-embedding.ts)
