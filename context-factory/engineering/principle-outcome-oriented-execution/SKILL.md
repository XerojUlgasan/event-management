---
name: principle-outcome-oriented-execution
description: "Complete a planned migration at explicit verification boundaries without leaving throwaway compatibility paths."
---

# Outcome-oriented execution

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Keep the user's verifiable final state intact throughout a planned rewrite or migration. State the phases, consumers, temporary local breakage allowed, and checks that close each phase.

Temporary breakage belongs in an isolated, reversible work unit. Do not expose it to users or deliver an independently broken commit/PR. Verify active areas during the migration and the integrated static/runtime behavior at completion.

Avoid compatibility code whose only purpose is to preserve a local intermediate state. For independent deployments, preserve rollout safety using a bounded transition under [migrate callers](../principle-migrate-callers-then-delete-legacy-apis/SKILL.md). Incomplete evidence or a passing narrow check does not satisfy a broader final outcome.
