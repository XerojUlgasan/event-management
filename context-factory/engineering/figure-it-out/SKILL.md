---
name: figure-it-out
description: "Build a verifiable plan and decision trail for a large Clemora task without a narrower workflow."
---

# Figure it out

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Define the requested final state as observable acceptance criteria. State the affected units, constraints, unknowns, and rigor needed. Use the [principle digest](../../shared/engineering-principles.md) and full relevant skills. Reversible work already authorized continues; a long task does not create a new approval requirement.

Design the workflow before the bulk implementation:

- Capture a useful baseline and build the smallest repeatable verification needed.
- Resolve the riskiest unknown early. Use architect for a consequential unsettled design; skip candidate exercises for a settled mechanical change.
- Break work into coherent verifiable units. Keep inseparable contracts and callers together and deployment boundaries safe.
- Identify the evidence each unit must produce and what would falsify its success. Delegate only when explicitly authorized and isolate any writers.

Run each unit as a hypothesis loop: state the expected improvement, make the smallest supported change, inspect the real result, and keep, revise, or revert it from evidence. Verify before dependent work. If a check is wrong, repair it rather than routing around it. Use verified, not verified, or inconclusive; do not turn an inconclusive result into a pass.

For multi-session or complex work, keep one compact sanitized decision trail in an existing task note or owning role reference. Record consequential choices, reasons, evidence pointers, observed results, pivots, blockers, and next actions as they occur. Correct false entries explicitly rather than rewriting history. Clemora has no kitchen ticket system; do not invent its commands or a pantry.

Audit the integrated current artifact against every original acceptance criterion, beyond the plan or test helper. Check documentation impact, final diff, and evidence limits. Report the completed outcome, decision-trail location when one was needed, checks, and remaining work. Do not redefine completion around the easiest subset.
