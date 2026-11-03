---
name: principle-prove-it-works
description: "Verify the actual changed artifact at the boundary claimed before declaring completion."
---

# Prove it works

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use the check that could disprove the result: run the feature, inspect the response/value, read back the persisted row, or render the affected state. Check process identity directly rather than inferring it from a listening port or old screenshot.

In Clemora, types/builds, route tests, direct SQL, browser journeys, Firebase emulator behavior, and production providers establish different things. Use the area guidance and [QA](../../QA/SKILL.md); do not treat one as proof of all the others.

Inspect the final dirty/untracked diff and test outputs, including skips and warnings. Check earlier evidence still matches the current artifact. Make a deterministic rerunnable check when useful, retain sanitized evidence proportionate to the task, and report missing proof plainly.
