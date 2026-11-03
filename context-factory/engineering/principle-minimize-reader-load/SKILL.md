---
name: principle-minimize-reader-load
description: "Reduce unnecessary indirection and mutable context when shaping or reviewing code."
---

# Minimize reader load

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Check both the layers a reader must trace and the hidden state they must remember. Prefer local state and returned values to broad mutation. Derive data instead of synchronizing another copy. Each boundary should hide a meaningful decision rather than repeat the same arguments.

Remove redundant wrappers and speculative adapters only when the authorized change benefits. Preserve Clemora's established controller/service/data ownership: HTTP mapping, transactions/business decisions, and SQL are distinct responsibilities even when a particular file is short.

A useful check is whether a new reader can locate where a value comes from and what can change it. Fix the actual source of confusion rather than optimizing line count.
