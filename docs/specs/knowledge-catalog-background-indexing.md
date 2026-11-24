# Knowledge Catalog: submit pending indexing to background jobs

Date: 2026-11-19 (Asia/Manila)  
Status: implemented and locally verified; hosted rollout and live provider remain unverified  
Evidence: `main` at `4131b0d`, including the inspected uncommitted working tree

Scheduling correction: the user subsequently approved [separate manual ensure and catalog-save refresh intents](../../context-factory/history/decisions/2026-11-19_catalog-index-scheduling.md). The current requirements below incorporate that correction; earlier run records retain the original successor/reset behavior as historical evidence.

## Outcome

Selecting **Index pending** discovers every eligible package and service needing indexing, collects their owner IDs, then submits each owner individually through the existing background queue. The worker indexes the listings independently of the Knowledge Catalog page.

Interpretation of “one by one”: await one owner-job submission before submitting the next. Each eligible listing still needing work gets an `embed_package` or `embed_service` job when it has no pending/running job, covering its text and photos. Execution retains the existing concurrency of three jobs per worker process; this proposal does not establish global serial execution.

The browser waits for submission to finish. After a successful submission response, the administrator can leave the page while the worker processes the accepted jobs. Submission is distinct from successful embedding.

## Baseline before implementation and reusable parts

- Before this change, `KnowledgePage` ran a browser cursor loop and the indexing workflow scanned at most five eligible owners and processed at most one pending, stale, or withdrawn chunk per request. It called embedding refresh directly, and leaving the page stopped subsequent requests. This baseline is recorded in the [specification investigation](../../context-factory/runs/2026-11-19_20-43-57_knowledge-background-indexing-spec.md). The current [page](../../apps/web/src/components/workspaces/admin/ai/KnowledgePage.tsx) and [workflow](../../apps/api/src/services/ai/workflows/index-pending-catalog-knowledge.ts) now implement the submission behavior below.
- Package/service create and update already reconcile knowledge and enqueue an owner job in the save transaction; see [package creation](../../apps/api/src/services/packages/create-package.ts), [package update](../../apps/api/src/services/packages/update-package.ts), [service creation](../../apps/api/src/services/services/create-service.ts), and [service update](../../apps/api/src/services/services/update-service.ts).
- [Job definitions](../../apps/api/src/services/background-jobs/job-definitions.ts) register strict identifier-only payloads, three-second polling, three concurrent jobs per worker process, 120-second embedding timeouts, and retries after 10 seconds, 60 seconds, and five minutes. The initial execution plus retries permits four attempts.
- [Package](../../apps/api/src/services/background-jobs/handlers/embed-package.ts) and [service](../../apps/api/src/services/background-jobs/handlers/embed-service.ts) handlers call the existing [owner refresh](../../apps/api/src/services/ai/workflows/refresh-catalog-embeddings.ts) without a chunk filter. It processes owner chunks sequentially, preserves matching vectors, removes withdrawn rows through reconciliation, and guards writes against superseded source content. A failed chunk makes the owner job retryable.
- The [enqueue service](../../apps/api/src/services/background-jobs/enqueue-job.ts) validates payloads before [inserting them in the queue](../../apps/api/src/data/background-jobs/enqueue-job.ts). Pending duplicates coalesce by type and owner; a running owner can have one pending successor. Re-enqueueing a pending job resets its attempts, error, and due time. The current return value identifies the job but does not distinguish a new row from a reused row.

The baseline findings came from source inspection. Implementation checks are recorded below.

## Required behavior

### 1. Discover all pending owners on the server

The server determines scope; the browser sends no owner IDs, chunk keys, table filters, or continuation cursor.

Use a consistent read snapshot and reuse [source loading](../../apps/api/src/services/ai/load-catalog-knowledge.ts), [preparation](../../apps/api/src/services/ai/workflows/prepare-catalog-knowledge.ts), and [freshness assessment](../../apps/api/src/services/ai/catalog-knowledge-status.ts). Collect distinct `{ kind, id }` owners before starting submissions. Release the discovery transaction before enqueueing.

Include all non-archived packages of type `catalog` and non-archived services, including unpublished listings, when any expected chunk is missing, pending, stale, or incompatible, or when stored withdrawn chunks need removal. This includes partial listings and owners with no `catalog_knowledge` rows. A `NULL embedding` query alone cannot identify this set. Skip fully current listings, archived listings, and private custom packages. Listing-name search, kind/status filters, and table pagination do not restrict this action.

Discovery must not reconcile rows, download media, or call the embedding provider. Photo freshness keeps the existing immutable-upload assumption: a well-formed stored photo input digest is accepted without comparing current image bytes. Metadata/source/model mismatches and missing or malformed digests remain detectable, but changed image bytes alone, including replacement of a checked-in sample file at the same path, are not discovered. Use the existing ingestion/backfill path for that case. Sort owners by kind (packages first), then ID, for predictable submission order. Do not cap the normal pass at the current five-owner scan limit or the visible table page.

### 2. Submit one owner at a time

For each collected owner, sequentially await a short, separate read-committed transaction. Lock the package/service owner row first, then reassess its current eligibility and freshness using the same owner-scoped assessment as discovery. If the owner is gone, ineligible or current, count it as skipped. Keep the discovery snapshot separate from these transactions.

For an owner still needing indexing, call the queue's ensure-scheduled operation with the existing strict `embed_package` / `{ packageId }` or `embed_service` / `{ serviceId }` identity. The queue operation holds the existing advisory transaction lock while checking matching pending/running jobs and inserting only if absent. An existing active job is skipped without changing its payload, lease, attempts, error, timestamps or backoff. Preserve owner-before-queue lock order; never take an owner row lock while holding the queue lock.

Do not send a list payload, create per-photo/per-chunk jobs, call handlers in HTTP, use `Promise.all` for submissions, or put the entire pass under the queue advisory lock. Count outcomes only after their transactions commit. Automatic catalog saves keep their existing atomic reconciliation and refresh enqueue behavior so real edits during indexing still schedule a successor.
The HTTP operation only discovers and enqueues. No embedding model or Storage configuration is needed to accept queue submissions; the worker retains responsibility for provider failures. Reuse the current worker, handlers, lease recovery, retries, and guarded writes. No new job type, batch table, schema migration, scheduler, or alternate embedding implementation is required.

Workers reload current source when executing. If an owner changes, becomes ineligible, or disappears after discovery, existing synchronization and guarded writes handle the current state rather than trusting a captured chunk list. A listing already brought up to date can finish as a harmless unchanged refresh. New or newly pending owners after the discovery snapshot belong to automatic save jobs or a later manual pass.

### 3. Report queue submission honestly

Replace the current browser/API cursor contract together:

```http
POST /v1/admin/ai/knowledge/index
Content-Type: application/json

{}
```

Keep session and System Administrator authorization. Validate a strict empty object; obsolete `cursor` input returns 400. Keep the existing small-body protection in Node and Edge. This is a coordinated API/web change, with no legacy synchronous indexing mode.

After attempting the complete discovered set, return **202 Accepted**:

```json
{
  "pendingListings": 12,
  "submittedListings": 2,
  "skippedListings": 9,
  "failedListings": 1
}
```

All fields are nonnegative integers; `pendingListings = submittedListings + skippedListings + failedListings`. Counts refer to listings, not chunks or provider calls. `pendingListings` is the discovery candidate count. `submittedListings` counts only newly inserted jobs. `skippedListings` covers matching pending/running work and listings that became current, missing or ineligible before submission. Zero candidates returns all four counts as zero. Submission does not imply successful embedding.
A recoverable per-owner enqueue error rolls back that owner's transaction, increments `failedListings`, and allows the next owner to be attempted. Successful earlier submissions remain committed. Return a sanitized 503 for failed discovery or a fatal/interrupted pass that cannot attempt the complete set; do not claim a complete pass. An interrupted request or lost response can leave a durable submitted prefix. The UI must explain that some work may already be queued and that selecting the action again is safe for remaining work. Do not include raw database/provider errors or listing content in responses or logs.

Retain the current 75-second HTTP budget, request cancellation, and bounded database statements/queue lock waits. Check cancellation between owners and await in-flight transaction settlement; never detach the loop into an untracked promise after returning a response. Discovery and submission must fit that budget for the supported catalog size. Validate this with a representative large fixture before implementation delivery; a timeout is a visible retryable failure, not silent truncation. If real catalog volume cannot fit, revise this design to a durable dispatcher before promising acceptance of the full set.

### 4. Update the existing screen

Keep **Index pending**, with a pending label such as “Submitting pending indexing…” only while the submission request runs. Replace the browser cursor loop and chunk progress with one request.

- Full submission: “12 listings queued. You can leave this page. Use Refresh to check coverage.”
- Already scheduled or current: “0 listings queued; 12 already queued or no longer need indexing. You can leave this page. Use Refresh to check coverage.”
- Partial submission: “2 listings queued; 9 already queued or no longer need indexing; 1 could not be queued. Select Index pending to retry remaining work.”
- Empty set: “No pending listings to submit.”
- Interrupted/error response: “Could not finish submitting pending indexing. Some listings may already be queued. Select Index pending to retry.”

Disable duplicate clicks during the request. After it settles, **Refresh** remains available and only reloads coverage. Reload coverage once after submission; later manual refreshes show actual persisted indexing progress. Do not optimistically mark listings indexed, show provider-completion counts, or keep a spinner running until embeddings finish. Remove the “keep this page open until finished” embedding instruction. Unmounting after acceptance must not cancel jobs or require browser continuation.

Reuse the current public `Button`, `PageHeader`, notifications, `KnowledgeHelp`, status text, and page styles. Their existing pending/disabled behavior supports this flow; no new shared component or token is needed. The UI implementation must complete the repository reuse audit and inspect rendered loading, partial, empty, and failure states.

### 5. Preserve recovery and coverage semantics

Coverage continues to measure current expected chunks. It is not queue progress: pending includes queued, retrying, and exhausted work. Keep those existing statuses; a separate queue-monitoring screen is outside this slice.

Repeated clicks and concurrent administrators use the atomic queue ensure-scheduled operation. They never create a successor or reset retry backoff for pending/running jobs. Workers recover expired running leases; the manual request leaves them untouched. A later click can create a fresh job for an idle owner still needing attention after its earlier job exhausted retries. Successful chunks remain reusable. A stopped worker leaves accepted work durable until a worker resumes.

Catalog saves express a different intent: changed source must be processed, so their existing enqueue may reset pending retries or create one pending successor behind a running job. Retain that behavior. Neither operation promises exactly-once provider usage or one historical job row per owner.

## Alternatives and selected approach

Choose server-side discovery followed by sequential owner submissions: it reuses the current all-catalog assessment and queue without exposing internal stages to the browser.

A browser fetch-and-enqueue loop keeps submission dependent on the page and can expose or accept an unnecessary owner list. A new dispatcher job would make discovery/submission durable immediately after one enqueue, but adds a job type and recovery semantics without demonstrated scale need. Keep that as the fallback if the bounded submission approach fails representative-size verification. Reducing all worker concurrency to one would affect unrelated jobs and does not follow from sequential submission.

## Implementation owners and delivery order

1. Replace `services/ai/workflows/index-pending-catalog-knowledge.ts` with provider-free discovery and sequential submission, reusing existing data/freshness owners. Keep SQL in `data/ai/` if another focused query is needed.
2. Update `controllers/ai/index-pending-catalog-knowledge.ts`, the shared `KnowledgeIndexResponse` in [contracts](../../packages/contracts/src/catalog-knowledge.ts), the [browser API call](../../apps/web/src/lib/data/ai/knowledge.ts), and `KnowledgePage` together. Inspect existing Node/Edge route matching, method/body limits, and response handling for the 202 contract. Remove obsolete cursor-only code/tests if no callers remain; retain the CLI backfill.
3. Extend existing catalog-indexing and queue tests. Update the [catalog implementation reference](../../context-factory/business/product.md#admin-knowledge-catalog) and the background-jobs area's manual-action description only when implementation lands. Preserve historical runs and decisions.

## Acceptance and verification plan

The following are acceptance criteria; the implementation evidence and its limits follow below:

1. One request discovers all pending owners across multiple table pages and more than five owners; missing rows, partial text/photo coverage, stale source/model/text-input digests, missing or malformed photo digests, and withdrawn rows qualify. Fully current, archived, and custom owners do not. Filters have no effect. A changed photo's bytes alone remain outside this provider-free discovery contract; test that the spec does not promise byte-level photo validation.
2. A listing with multiple chunks produces one owner submission. Verify strict existing payloads, sequential enqueue calls, separate commits, accurate submitted counts, and no provider or Storage calls during the request. Missing provider configuration does not prevent enqueueing.
3. Manual submissions leave pending/running jobs unchanged, including retry backoff and expired leases. Hold a real worker in a synthetic provider call and verify repeated/concurrent HTTP submissions do not add job rows. Verify completion between discovery and submission, source edits during running, archive/delete, terminal failure retry, enqueue rollback, partial failure, cancellation and replay. Actual catalog saves must still create a successor for changed content. Earlier committed jobs survive later failures; counts distinguish newly inserted and skipped work.
4. After acceptance and page unmount, the worker processes accepted jobs, including text and photos. Synthetic provider failures trigger existing retries; success updates actual coverage and semantic retrieval. A stopped worker preserves pending work; restart recovers it. Concurrent source edits/archive/delete must not restore obsolete chunks.
5. Verify 401/403, malformed and obsolete cursor input, body caps, 202/503 bodies, and matching OpenAPI/contracts/browser behavior in Node and Edge. Test the complete representative-size scan and submission against the existing request budget without paid provider calls.
6. Inspect browser keyboard activation, pending/disabled behavior, success, partial, empty, interrupted request, manual Refresh, and navigation after acceptance. Reuse the public UI components and preserve actual coverage until jobs complete.

Inspect fixture setup before running the existing `pnpm --filter @event-management/api test:catalog-knowledge` and `pnpm --filter @event-management/api test:background-jobs` suites; use disposable databases and synthetic providers. Run affected type checks and Edge/browser verification. Live provider quality and hosted worker deployment require separate evidence.

## Scheduling correction verification

The [scheduling run](../../context-factory/runs/2026-11-19_21-52-00_catalog-index-scheduling.md) records the corrected implementation. Disposable pgvector and synthetic-provider verification passed 51 catalog checks (four absent-client-role checks skipped) and 11 queue/standalone-worker checks. The original gated-provider reproducer now retains one job through concurrent manual requests and three failure/retry cycles. Tests also prove source edits during a running worker are processed by the legitimate successor. Independent Sol source review found no actionable issues. API/web/UI types, web/Edge builds, synthetic rendered feedback, scoped formatting, guidance and environment checks passed. Unrelated workspace structure/design findings and live/hosted verification limits are recorded in that run.

## Earlier implementation evidence and limits

The evidence below predates the scheduling correction. It does not establish the corrected no-op behavior; see the successor run linked from the scheduling decision for current verification.

The [specification investigation](../../context-factory/runs/2026-11-19_20-43-57_knowledge-background-indexing-spec.md), [manual indexing run](../../context-factory/runs/2026-11-18_21-10-22_knowledge-index-pending.md), and [catalog jobs run](../../context-factory/runs/2026-11-19_15-53-34_catalog-background-jobs.md) locate the baseline evidence. A Luna agent traced queue lifecycle during specification, Terra agents implemented the API and web parts, and an independent Sol review found no actionable findings. Existing UI exports, Button/PageHeader implementations and stories, notifications, page styles, contracts, and theme tokens were inspected and reused.

The user subsequently authorized implementation. [Catalog embedding integration tests](../../apps/api/tests/ai/catalog-embeddings.test.ts) cover discovery eligibility, missing rows, partial/stale/withdrawn content, empty sets, auth, strict input, provider-free submission, partial rollback/replay, running successors, cancellation retaining committed work, and synthetic worker text/photo indexing through semantic search. A 250-owner fixture with one injected enqueue failure completed its first pass in 700 ms on a disposable local PostgreSQL instance; this is fixture timing, not a production latency guarantee. Existing queue/worker tests cover leases, retries, interruption recovery, and independent worker lifecycle.

[HTTP dispatch tests](../../apps/api/tests/knowledge-index-http.test.ts) exercise the Node and Edge source dispatchers for missing sessions, body limits, and the strict empty request/202 OpenAPI contract without querying application data. API/web types, web and generated Edge builds, scoped lint/formatting, and synthetic browser checks provide additional evidence. Browser checks covered keyboard activation, held-response/disabled controls, success/partial/empty/error messages, one POST per action, one automatic coverage reload, manual Refresh, unmount before response settlement, and a mobile viewport. They used synthetic responses, not an authenticated application database.

Hosted Edge execution, actual application pending counts, live provider quality, and deployment are not established. Four role-specific catalog migration checks skipped because the disposable database lacked Supabase client roles. Workspace structure/design checks retain unrelated catalog and message-style findings. The [implementation run](../../context-factory/runs/2026-11-19_20-48-44_knowledge-background-indexing.md) records the final checks and remaining boundaries.
