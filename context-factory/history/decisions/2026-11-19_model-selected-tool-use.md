# Model-selected tool use

Date: 2026-11-19
Status: accepted
Authority: User explicitly rejected forcing every turn through `selectTurnEvidence` and instructed its removal.
Implementation: implemented locally; verification is recorded in the linked run.

## Problem

The required evidence-selection step forced a tool call and an extra generation even for a greeting. Completing that step did not establish that the model understood the question or selected the correct evidence.

## Decision

Remove the selector, its required first-step call, callback, and reply-publication gate. The existing assistant chooses whether to answer directly or use public catalog tools and the customer-only proposal tool from its first step. Keep the bounded loop's final answer step.

Retain fresh booking context, historical assistant labels, and prompt guidance about current saved facts and completed lookups. Actual tool calls retain argument validation, server-owned scope, access checks, execution records, budgets, cancellation, and human-takeover guards. Tracking failures still block replies. Sanitized read errors can be explained by the model.

## Alternatives considered

- Retain the mandatory selector: rejected by the user because forcing a call does not establish understanding.
- Add another decision model: outside this removal request and unnecessary for restoring optional tool use.

## Rationale

The user's instruction places the choice to answer or gather more information with the assistant. Code continues enforcing access and execution boundaries independently of that choice.

## Consequences

Direct answers can finish in one generation without record reads or tool-call records. Tool selection and answer grounding remain model-dependent; deterministic orchestration tests do not establish live-model judgment.

## References

- Supersedes [Evidence selection before assistant answers](2026-11-18_assistant-evidence-grounding.md).
- [Current evidence standards](../../areas/ai/references/standards-and-verification.md#evidence-before-answers).
- [Removal run](../../runs/2026-11-19_00-19-05_remove-mandatory-evidence-selection.md).
