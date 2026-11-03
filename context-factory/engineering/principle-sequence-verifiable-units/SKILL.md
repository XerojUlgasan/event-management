---
name: principle-sequence-verifiable-units
description: "Break multi-step work into coherent units with checks before dependent work continues."
---

# Sequence verifiable units

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Capture the checkout, revision, existing edits, and useful baseline. Order the work so each unit has a clear before/change/after check. Verify the unit before building on it; an inconclusive result is not green.

For a bug, demonstrate the failing reproduction and passing fix in one delivered unit. For a migration, verify data and consumers at each safe boundary. Keep inseparable contracts and callers atomic, and deliver each PR in a state that satisfies its own checks.

Do not land a deliberately failing test as an independent change. Temporary local breakage follows [outcome-oriented execution](../principle-outcome-oriented-execution/SKILL.md); PR sequencing follows [pull requests](../pull-requests/SKILL.md). Do not create commits or PRs unless the task calls for them.
