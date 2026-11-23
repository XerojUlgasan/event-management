# Latest AI handoff on the conversation

Date: 2026-11-19
Status: accepted
Authority: User approved the handoff tool and admin reason indicator, then explicitly chose a small conversation JSONB object instead of a separate history table or takeover tracking.
Implementation: implemented; see the [run](../../runs/2026-11-19_00-57-12_ai-human-handoff.md) for verification and limits.

## Problem

An administrator needs to discover a conversation awaiting human review and understand why AI stopped. An AI-off preference alone does not explain whether AI requested help or an administrator took over.

## Decision

Store only the latest `{ reason, summary, pending }` in nullable `conversations.ai_handoff`. Reasons are `customer_requested`, `needs_admin_review`, and `cannot_answer`; the summary is trimmed and bounded by the shared contract. There are no handoff timestamps, takeover identities, or separate handoff history table.

The server binds conversation, identity, triggering message, and AI version. A successful tool transaction pauses AI, advances the version, saves a fixed customer acknowledgement, and completes/links its existing execution record. The tool stops the model loop after commit. Repeat invocations for the same triggering message reuse the acknowledgement.

Only administrators receive metadata in conversation responses. The inbox and header mark pending handoffs, and a shared information disclosure shows the reason and AI summary by hover/focus or click/keyboard activation. The first successful administrator reply, including a quotation, clears pending while preserving the explanation. Reading, failed replies, and re-enabling AI do not clear it. Pending-state changes advance the conversation AI version to reject stale browser polling.

## Alternatives considered

- A separate event table would preserve every handoff and takeover, but exceeds the requested current-state scope.
- Putting the reason only in tool-call JSON would couple the operational inbox to execution-audit reconstruction and would not give it an explicit pending state.

## Consequences

A later handoff replaces the previous explanation. Execution audits retain their existing ownership, independent of the current-state JSONB. Handoff success requests inbox review; it does not assign a person, send external notifications, promise a response time, or resolve the inquiry. The acknowledgement is deterministic English; other assistant replies retain the existing language instructions.

## References

- [Message policy](../../business/messages.md#ai-requested-human-review)
- [Assistant walkthrough](../../areas/ai/references/code-examples.md#human-handoff-mutation)
- [Shared contract](../../../packages/contracts/src/ai-handoff.ts)
- [Transaction](../../../apps/api/src/data/messages/request-human-handoff.ts)
