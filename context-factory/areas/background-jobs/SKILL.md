---
name: background-jobs
description: Implement, investigate, or review Clemora's durable background queue, worker, job types, and retry behavior.
---

# Background jobs

Use this guide with [API](../api/SKILL.md) and the selected task workflow. Inspect the current implementation and its callers before changes; source and package scripts are authoritative. Starting a worker can process queued jobs and make paid provider calls.

## Ownership

- `apps/api/src/data/background-jobs/` owns queue SQL and short state-transition transactions.
- `apps/api/src/services/background-jobs/job-definitions.ts` owns worker settings, payload schemas, handlers, and retry and timeout policy. `enqueue-job.ts` validates and enqueues within the caller's transaction; `run-worker.ts` claims, executes, heartbeats, and finishes jobs.
- Job handlers live under `apps/api/src/services/background-jobs/handlers/`; the embedding workflow owns preparation and provider operations. Package and service photos are chunks of their owner's embedding job, not separate jobs.
- `apps/api/src/workers/background-jobs.ts` is the supervised Node entry point. The HTTP Edge function does not host persistent polling. The [README](../../../README.md#configuration) describes local and hosted setup; consult package scripts before running them.

## Queue behavior

Catalog saves reconcile chunks and enqueue the owner in the same transaction when eligible chunks exist, without waiting for an embedding provider. Media promotion and cleanup retain their existing after-commit lifecycle. The Knowledge Catalog's manual **Index pending** action and `catalog:embed` CLI remain separate paths.

The registry currently defines `embed_package` with strict `{ packageId: UUID }` and `embed_service` with strict `{ serviceId: UUID }`. It sets a 3-second poll interval, two concurrent jobs per worker process, a 60-second lease with a 20-second heartbeat, 120-second job timeouts, and retry delays of 10 seconds, 60 seconds, and 5 minutes. Initial execution plus three retries allows four attempts. These policies live in code and changes also apply to already queued jobs.

Queue transitions use a short global advisory transaction lock; provider calls occur outside queue transactions. A lease token fences heartbeat and completion, and expired leases are recovered. Pending jobs deduplicate by type and owner, while a running job can have one pending successor. Live leased claims for the same type and owner are serialized; an expired invocation can overlap a later claim until it honors cancellation. If an older running job fails or expires while a successor is pending, the older job fails as superseded and the successor remains. Leases provide at-least-once execution, so handlers must tolerate replay. Failed embedding chunks make the owner job retryable. Unknown job types remain unclaimed; invalid payloads fail terminally. Keep errors and logs bounded and sanitized.

## Add or change a job type

1. Trace the initiating transaction, domain operation, side effects, owner identity, and failure behavior. Define a strict payload containing only necessary identifiers, and choose a deduplication key and recovery semantics.
2. Add the handler and register its payload schema, deduplication key, handler, retry delays, and timeout in `job-definitions.ts`; enqueue through `enqueue-job.ts` in the transaction that commits the triggering change.
3. Make handlers honor `AbortSignal` before side effects and pass it to cancellable operations. Cancellation stops the runner waiting and heartbeating, but cannot terminate arbitrary JavaScript or undo external effects. Test atomic enqueue/rollback, duplicate and successor handling, concurrency, lease expiry and fencing, retry exhaustion, invalid payloads, and handler failures as applicable. Check cancellation and stale writes for external work.
4. Inspect scripts and test side effects, then run `pnpm --filter @event-management/api test:background-jobs` and the affected domain suite (for embeddings, `pnpm --filter @event-management/api test:catalog-knowledge`). Use isolated database fixtures and synthetic providers. Report runtime, database, provider, and deployment evidence separately.
