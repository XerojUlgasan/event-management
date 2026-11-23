# Assistant evidence grounding

Started: 2026-11-18T23:41:18+08:00
Updated: 2026-11-18T23:44:02+08:00
Status: complete
Scope: User-authorized implementation of general evidence grounding, including initial factual questions and implicit follow-ups. No live provider calls, configured application-data writes, migrations, service restarts, deployment, commit, or push.
Checkout: main at 5939511; existing uncommitted proposal-tool work preserved.
Continues: [Conversation-scoped proposal tool](2026-11-18_22-53-38_get-my-proposal-tool.md).

## Goal

Use current server context and appropriate current tool reads for saved facts instead of prior assistant statements. Require evidence acquisition before publishing an answer and preserve private access, audit, cancellation, takeover, and size limits.

## Result

The agent now forces an evidence selector before the answer stage. Selected reads execute through existing adapters; invalid, skipped, duplicate, bypassed, or failed selection blocks the reply. Earlier assistant messages carry historical provenance, and current context is positioned beside the latest customer message. Prompt instructions require current evidence for both positive and negative claims and distinguish supplied context from completed lookups.

## Changes or findings

- Sol reviewed the design; Terra implemented the selector and migrated assistant tests; the lead integrated prompt, guest tests, and documentation.
- Selected reads retain their audit records and shared budgets. The selector stores bounded counts rather than private content.
- Independent review identified guest description/schema inconsistency and uncounted selector-result overhead. Both were corrected and independently re-reviewed; exact-fit and one-character-short combined-result cases cover the budget boundary.

## Decisions

[Evidence before answers](../history/decisions/2026-11-18_assistant-evidence-grounding.md) records rationale and model-dependent limits.

## Verification

The final serialized run passed 65 tests across `assistant-turn`, `get-my-proposal`, `tool-calls`, and `guest-chat`, using synthetic providers and disposable local PostgreSQL databases. It covers initial and implicit proposal reads, changed booking context, selection bypass/failure/duplicates, guest access, audit linkage, size limits, cancellation, and takeover. API types and Edge bundling pass. Guidance checks, nine guidance tests, affected AI/TypeScript/documentation/continuation routing scenarios, formatting, and the final diff audit pass. Test-only type errors caught during integration were corrected before the final successful typecheck. Source and orchestration checks do not establish real model selection, browser behavior, served Edge, or hosted rollout.

## Remaining work

No required implementation remains. Live-model source selection and interpretation, browser behavior, and hosted rollout remain separate verification work.

## Resume here

Review the scoped diff starting with the selector, agent factory, turn entry, and assistant/guest regression tests. Preserve the earlier proposal implementation. If live evaluation is authorized, test initial questions, implicit follow-ups, mixed-source questions, false historical claims, and unavailable evidence with the configured model.
