---
name: principle-laziness-protocol
description: "Solve the requested problem with the smallest sufficient change and one owner for each decision."
---

# Laziness protocol

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Bias toward deletion, existing patterns, and fewer layers. Consolidate a repeated decision at its canonical owner and pass the result where needed. Avoid speculative abstractions, dependencies, and state threaded through unrelated code.

In Clemora, reuse contracts for shared limits and existing UI/theme owners. Keep required controller/service/data responsibilities; a smaller diff does not justify moving SQL into a page or deleting authorization.

Judge size against the complete requested outcome. A small workaround that leaves the root cause or a required consumer unfixed is insufficient. Preserve unrelated work even when it looks redundant.
