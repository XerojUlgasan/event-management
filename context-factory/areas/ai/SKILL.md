---
name: event-management-ai
description: Design, implement, investigate, or review AI agents, tools, prompts, decisions, retrieval, or AI Gateway integration in Clemora.
---

# AI

Use this area for the application's AI domain. The agreed starting location is `apps/api/src/services/ai/`, using Vercel AI SDK and AI Gateway. This guide establishes placement and engineering standards; it does not implement an assistant or approve new business actions. The root [README](../../../README.md#product-scope) owns product scope, open decisions, and implementation status.

## Read for the task

- For any AI change, read [structure and naming](references/structure-and-naming.md) and [standards and verification](references/standards-and-verification.md). Inspect the current caller, model configuration, relevant services, and tests before choosing an implementation.
- When building or examining the individual files, use the [connected code examples](references/code-examples.md). They demonstrate all proposed files and mark future dependencies; adapt them to the installed SDK and actual task rather than copying the complete tree.
- When assigning a scoped AI task, use the [one-shot prompt example](references/one-shot-prompt.md). A saved prompt is a template, not authorization to execute it.
- For HTTP routes, service/data ownership, configuration, or runtime integration, also read [API](../api/SKILL.md). For private customer context or tools, read [auth and sessions](../api/references/auth-and-sessions.md) and the matching [business references](../../business/README.md); verify enforced permissions separately.
- For request/response contracts or shared limits, add [contracts](../contracts/SKILL.md). For chat UI or browser consumers, add [frontend](../frontend/SKILL.md) and [packages](../packages/SKILL.md), including their required reuse references.

## Work in order

1. Establish the authorized slice and current state. Follow the selected [workflow](../../README.md#choose-the-task); investigation and review remain read-only. For continuation, inspect the newest relevant [run](../../runs/README.md) and current source.
2. Read the installed `ai` package's version-matched docs and source. Check the exact model's modality and capability in the live Gateway catalog when introducing or changing model use. Credentials remain server-side in the existing env owner.
3. Keep one application entry for an assistant turn. Give its tools only the capabilities and trusted scope required for that task; reuse existing business services and data owners. Add a separate decision, retrieval step, or workflow when it has a concrete responsibility.
4. Before enabling persistence or handoff, resolve the relevant source, ownership, lifecycle, and replay requirements. Draft examples remain drafts until the application has a defined and verified submission path.
5. Complete the relevant checks from [standards and verification](references/standards-and-verification.md#verification), inspect the final diff, and update affected current docs. Report source/type/test/API/database/browser/provider evidence separately, including limits and skipped checks.
