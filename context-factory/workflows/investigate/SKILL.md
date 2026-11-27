---
name: amac-investigate
description: Investigate or explain current behavior, diagnose a failure, plan a design, recover context, or examine rationale before changing AMAC.
---

# Investigate

Use for exploration, explanation, planning, or diagnosis. Follow the requested read-only boundary; an investigation does not authorize its proposed fix.

## Establish the answer

1. State the question, expected outcome, and known constraints. Select affected area/domain guides from the [router](../../README.md).
2. Inspect the actual checkout, callers, configuration, contracts, tests, and active target where runtime evidence matters. Trace the input through the layers that exist to its visible or persisted result. For startup/framework claims, follow package scripts → configuration → entry point.
3. Separate approved requirements, source behavior, observed runtime results, and inference. Seek a counterexample to the leading explanation. Use bounded reads and retain evidence/next actions rather than raw tool output.
4. For a failure, reproduce the smallest observable case and trace backward to the first wrong state/decision. Verify the running process, API base, and database target. After two failed fixes sharing a premise, test that premise before another attempt. Handle legitimate states; repair invalid producers rather than masking them with retries or discarded data.
5. Deliver the explanation, supported findings or concrete proposal, source links, unresolved questions, and the next useful action. For a complex continuation, write a [run](../../runs/README.md).

## Read for the question

| Question | Reference |
| --- | --- |
| TypeScript source investigation or explanation | [TypeScript](../implement/references/typescript.md) |
| Consequential unsettled architecture or novel interaction | [Design comparison](references/design.md) |
| Why a guard, threshold, design, or regression exists | [Rationale and confidence](references/rationale.md) |
| Teach a broader subsystem | [Explanation](references/explanation.md) |
| Resume previous work or reconstruct recent context | [Continuation](references/continuation.md) |
| Review lessons or prevent recurring mistakes | [Retrospective](references/retrospective.md) |
| Improve a task/prompt without implementing it | [Prompt refinement](references/prompt-refinement.md) |

When changes are authorized after diagnosis, use [Implement](../implement/SKILL.md); do not substitute a passing narrow check for the requested outcome.
