# Evidence selection before assistant answers

Date: 2026-11-18
Status: superseded
Superseded by: [Model-selected tool use](2026-11-19_model-selected-tool-use.md). The mandatory selector was removed on 2026-11-19; the original rationale and verification below remain historical.
Authority: User authorized changing the assistant to establish saved facts from current context and tools rather than previous assistant answers; the implementation design was selected within that scope.
Implementation: implemented locally; final verification is recorded in the linked run.

## Problem

An earlier booking denial influenced later answers, and the assistant claimed repeated checks without new tool execution. An instruction to refresh facts already existed, but optional tool selection permitted answers based on historical assistant claims. A phrase-specific refresh rule would leave initial questions and implicit follow-ups with the same weakness.

## Decision

Require `selectTurnEvidence` as the only first-step call in the existing agent. It validates the needed reads and executes the existing audited readers, returning their actual current results. Current booking fields already come from the owned server snapshot; ordinary conversation can select no record reads. Guests cannot select private proposals.

Reject missing, malformed, duplicate, bypassed, or failed selection before saving a reply. Preserve domain access, cancellation, takeover, audit, and size guards. Record coordinator counts separately from child executions; child call IDs derive from the selector invocation. Label old assistant replies as historical claims and place current context beside the latest customer message.

## Alternatives considered

- Prompt-only freshness rules: smaller, but still permit a reply without completing a selected read.
- Refresh-word matching: misses initial questions, implicit references, and other languages.
- Load every proposal on every turn: creates unnecessary private reads during ordinary conversation and leaves public catalog selection unresolved.
- Separate planning model: adds configuration and orchestration when the existing loop can own the required first step.

## Consequences

Selection adds a generation even for greetings. Initial reads run within that step, leaving the remaining bounded loop for further reads and an answer. A required read failure blocks publication instead of accepting potentially stale prose.

The model still selects sources and interprets evidence. Code guarantees execution of selected reads and the publication gate, not correct semantic classification or truth of all prose. Synthetic tests establish orchestration; representative live-model evaluation remains separate.

## References

- [Evidence and execution standards](../../areas/ai/references/standards-and-verification.md#evidence-before-answers)
- [Current implementation](../../../README.md#current-implementation)
- [Implementation run](../../runs/2026-11-18_23-41-18_assistant-evidence-grounding.md)
