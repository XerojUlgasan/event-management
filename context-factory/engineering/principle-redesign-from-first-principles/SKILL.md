---
name: principle-redesign-from-first-principles
description: "Reconsider the owning design when a new requirement repeatedly creates exceptions."
---

# Redesign from first principles

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Read the affected flow and ask what shape would fit if the new requirement had existed from the beginning. Compare that shape with the current ownership, callers, contracts, and deployment constraints.

Think through the full required change, then deliver it in scoped verifiable units. Update affected types, callers, tests, rationale, and docs together. Repeated casts, synchronized state, or callers coordinating private stages suggest the model needs reconsideration.

This does not authorize rewriting unrelated systems. Keep the user's outcome and approved business rules; use [architect](../architect/SKILL.md) when a consequential design choice needs candidate comparison.
