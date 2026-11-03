---
name: principle-subtract-before-you-add
description: "Remove obsolete complexity within scope before building on it."
---

# Subtract before you add

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Identify dead code, duplicate decisions, stale references, and redundant validation in the affected flow. Remove supported obsolete paths before adding the replacement so future contributors have one clear example.

Verify consumers and behavior before deleting anything. Required authorization, database constraints, legitimate failure handling, migration history, and unrelated work are not dead weight. Do not use this principle to broaden a small task into a cleanup project.

Keep guidance at its canonical owner and link rather than copying the same rule into every skill. Delete an obsolete reference instead of retaining an empty placeholder.
