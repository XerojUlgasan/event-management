---
name: principle-explain-the-number
description: "Verify measured performance or evaluation claims before reporting or acting on them."
---

# Explain the number

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Name the resource or code path that limits the measurement using a profile or counters from a real run. Map the observation to source. Ask why the result is not twice as good.

Rule out errors, rejected or skipped work, caching, a path that never ran, an untuned comparison, and noise. Confirm the changed portion could account for the claimed end-to-end gain. Keep units, data size, run count, spread, and limiter evidence with the result.

Use [benchmark checklist](../benchmark-checklist/SKILL.md) for performance comparisons. For evaluation results, verify task completion and repeatability across the relevant trials. Missing evidence makes the conclusion inconclusive rather than faster or better.
