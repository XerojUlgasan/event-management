---
name: how
description: "Explain current Clemora runtime flow, file ownership, or subsystem architecture from source."
---

# How

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Honor explanation-only scope. Establish the question and the few concepts needed to answer it. State a routine interpretation if the target is vague and inspect the owning area guidance.

Trace an actual input or user action through the relevant entry point, state, request, validation/permissions, service, query, response, and visible result. For framework claims, follow package scripts, configuration, and entry point together. Inspect only the stages that exist; demo/local data must not become a claimed backend workflow.

For a narrow question, investigate and explain directly. For a broad subsystem, split the investigation into distinct slices and synthesize one coherent account. Helpers require explicit authorization under the adapters; sequential slices are sufficient otherwise.

Present what the feature is, its key concepts, the actual flow, the few files that matter, and relevant pitfalls. Use source links and a small diagram only when useful. Keep source interpretation distinct from observed runtime evidence. Use [why](../why/SKILL.md) for motivation/history and [teach](../teach/SKILL.md) when the user wants a guided explanation.

A Clemora package save, for example, runs from React and lib/api.ts to a route schema/handler, transaction-owning service, focused Kysely data function, and mapped response. Confirm the touched implementation instead of assuming every operation needs every layer.
