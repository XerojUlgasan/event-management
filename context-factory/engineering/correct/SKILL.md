---
name: correct
description: "Prevent demonstrated recurring engineering mistakes at the strongest useful structural level."
---

# Correct

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use for a requested recurring-mistake correction. Review accessible in-scope commits, reverts, review comments, instructions, and the user's corrections. Group supported examples into mistake classes; one isolated incident does not establish a recurring class.

For each repeated class, try the strongest useful correction:

1. Architecture: one owner, one supported path, inaccessible internals, or removal of an obsolete example.
2. Types or an actionable lint/check: reject the wrong state/import/contract and name the valid alternative.
3. Behavior tests: catch the observable failure while surviving an internal refactor.
4. Guidance: explain only the judgment that cannot be expressed structurally, with a concrete example.

Keep work within the authorized outcome. Present unrelated classes as proposals. Do not invent a lint or CI gate that this repo does not have. If a new check is justified, prove it fails on a representative real mistake and accepts the valid case. Keep a compact rule-to-enforcement note beside its owner when useful.

Use [reflect](../reflect/SKILL.md) for a session retrospective and [role memory](../../agents/README.md#memory) for durable project lessons. Skill/rule updates do not authorize editing personal memory or plugin caches. Report evidence, chosen enforcement, why a stronger mechanism was unsuitable, checks, and gaps.
