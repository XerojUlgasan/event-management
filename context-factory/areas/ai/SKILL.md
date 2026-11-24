---
name: event-management-ai
description: Design, implement, investigate, or review AI agents, tools, prompts, decisions, retrieval, or AI Gateway integration in Clemora.
---

# AI

The assistant uses Vercel AI SDK and AI Gateway in `apps/api/src/services/ai/`. This area explains how to extend that implementation. Check the [product reference](../../business/product.md) for approved scope and current capabilities. For setup, see [AI configuration](../../workflows/implement/references/development.md#configuration).

## Read for the task

- For any AI task, read [structure and naming](references/structure-and-naming.md) for ownership and [standards and verification](references/standards-and-verification.md) for invariants and checks. Inspect the affected source and tests before choosing a change.
- To understand registration, tool definitions, or the turn lifecycle, follow the [current code walkthrough](references/code-examples.md).
- To assign an extension, adapt the [task prompt](references/one-shot-prompt.md) to the authorized outcome.
- For HTTP integration, services/data, configuration, or runtime changes, also read [API](../api/SKILL.md). For customer context, private tools, or business actions, add [auth and sessions](../api/references/auth-and-sessions.md) and the matching [business references](../../business/README.md); verify implemented permissions separately.
- For shared contracts or limits, add [contracts](../contracts/SKILL.md). For chat UI or browser consumers, add [frontend](../frontend/SKILL.md) and [packages](../packages/SKILL.md), including their mandatory reuse references.

## Work in order

1. Establish scope and current state through the selected [workflow](../../README.md#choose-the-task). Investigation and review remain read-only. For continuation, verify the newest relevant [run](../../runs/README.md) against the checkout.
2. Trace the existing caller through the application entry, agent, tool, service, and data owner. Choose the smallest change at the responsible layer; the ownership guide identifies when another layer is needed.
3. Apply the standards for access, execution records, evidence, and failure handling. Resolve missing ownership or lifecycle decisions before enabling a dependent action.
4. Run the [checks for the changed responsibility](references/standards-and-verification.md#verification), inspect the final diff and affected documentation, and report the evidence and its limits.
