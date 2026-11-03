---
name: principle-build-the-lever
description: "Use a small repeatable tool when it materially improves nontrivial editing or verification."
---

# Build the lever

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

For repeated edits, complex comparisons, or checks whose correctness is hard to inspect manually, build the smallest script, query, codemod, or generator that performs or proves the work. Learn the recipe on one unit, then compare the tool's result with that unit before applying it broadly. Make reruns safe.

Prefer a deterministic tool to manually distributing identical edits. Keep a useful durable tool with its owning guidance; use isolated scratch space for temporary proofs. The tool must check the real artifact and fail on the mistake it claims to detect. A parser that finds links cannot prove architecture or behavior.

Do not build a framework for a few obvious edits. This principle improves repeatability; it does not require new infrastructure on every task or authorize additional changes.
