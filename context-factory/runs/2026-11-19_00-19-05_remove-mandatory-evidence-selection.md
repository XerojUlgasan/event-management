# Remove mandatory evidence selection

Started: 2026-11-19T00:19:05+08:00
Updated: 2026-11-19T00:20:56+08:00
Status: complete
Scope: User-authorized removal of forced evidence selection. Preserve existing proposal-tool work and unrelated changes. No live model calls, configured application-data writes, migrations, service restarts, deployment, commit, or push.
Checkout: main at 5939511, with existing uncommitted proposal-tool and evidence-grounding changes.
Continues: [Assistant evidence grounding](2026-11-18_23-41-18_assistant-evidence-grounding.md).

## Goal

Let the assistant choose a direct answer or available tools from its first model step, without requiring a selector call to publish a reply.

## Result

Removed the selector implementation, registration, forced first step, success callback, reply gate, and obsolete selection tests. Existing customer proposal and public catalog tools remain available through normal model-selected calls.

## Changes or findings

- Preserved current booking context, historical assistant labels, proposal JSON fidelity and size budget, server-owned scope, audit records, cancellation, takeover, and final answer limits.
- Restored direct catalog/guest fixtures and added explicit one-generation/no-tool regressions for customers and guests. Proposal reads can execute on the first step.
- Updated current README and AI guidance; marked the earlier selector decision superseded and preserved its historical run.

## Decisions

[Model-selected tool use](../history/decisions/2026-11-19_model-selected-tool-use.md) records the user's direction and remaining model-dependent limits.

## Verification

Baseline: all 65 focused tests passed. After removal, all 62 remaining/updated assistant, proposal, tool-audit, and guest tests passed with synthetic providers and disposable local PostgreSQL databases, including direct replies without calls and first-step reads. API types, Edge bundling, guidance checks, nine guidance tests, scoped source/README formatting, and diff whitespace checks passed. The affected AI implementation, narrow TypeScript, repository-guidance, continuation, and decision-record routing scenarios were walked against their current targets. Proposal service/adapter/context types/tests and earlier run records remain byte-for-byte unchanged. No browser, served Edge, hosted deployment, or live-model selection/interpretation was tested.

## Remaining work

No required implementation remains. Live-model evaluation and hosted rollout remain separate.

## Resume here

Inspect the agent factory and turn entry, then direct-answer and first-step-tool regressions. Preserve the proposal implementation and distinguish deterministic orchestration proof from live-model selection quality.
