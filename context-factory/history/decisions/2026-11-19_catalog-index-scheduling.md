# Manual catalog indexing ensures scheduled work

Date: 2026-11-19
Status: accepted
Authority: The user approved a permanent queue-level fix after reproducing extra background-job rows from repeated Index pending clicks during execution.
Implementation: implemented; verification tracked in the [implementation run](../../runs/2026-11-19_21-52-00_catalog-index-scheduling.md).

## Problem

Manual indexing used the same enqueue operation as catalog saves. That operation coalesces pending jobs by resetting their retry state and permits a successor behind a running job. An unchanged manual request could therefore create redundant jobs or bypass retry backoff. Earlier indexing tests explicitly accepted this behavior.

## Decision

The queue module exposes two scheduling intents. `ensureBackgroundJobScheduledService` leaves matching pending/running jobs untouched and inserts only when neither exists. The existing `enqueueBackgroundJobService` retains refresh semantics for actual catalog saves, including pending retry reset and a successor behind running work.

Manual indexing processes discovered owners in separate short read-committed transactions. Each locks the owner, reassesses current eligibility/freshness, then ensures scheduling under the existing queue advisory transaction lock. The owner-before-queue order matches saves. The discovery snapshot is never reused for the freshness recheck.

The response distinguishes newly inserted, skipped and failed work. Skips cover active jobs and owners that became current, missing or ineligible. Expired running jobs remain with worker recovery; a terminal failure permits a fresh manual attempt when indexing is still needed.

## Alternatives considered

- A browser-only guard cannot serialize separate users or requests.
- Changing uniqueness to permit only one pending/running row would require a new durable generation or requeue mechanism to preserve edits arriving during execution. Existing workers capture a source set and guard superseded writes; blocking successors alone could lose indexing work.

## Rationale

Centralizing the active check and insert under the queue lock addresses the reproduced state transition and concurrent callers. Separate intents preserve committed source changes without making manual retries mutate live work. Existing schema and lease recovery remain sufficient.

## Consequences

No migration, new job type or provider path is needed. API, contracts, UI and current documentation must deploy together. Legitimate edit successors, terminal retries and at-least-once provider execution can still produce history or repeated provider calls.

## References

- [Current specification](../../../docs/specs/knowledge-catalog-background-indexing.md)
- [Background jobs](../../areas/background-jobs/SKILL.md)
- [Earlier implementation evidence](../../runs/2026-11-19_20-48-44_knowledge-background-indexing.md), retained as history of the superseded manual behavior.
