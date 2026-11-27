---
name: amac-review
description: Review a AMAC diff, branch, PR, working tree, or design with source-grounded findings and read-only verification.
---

# Review

Read the [code-review reference](references/code-review.md) and affected area/domain guides. Review remains read-only; implement accepted fixes only within a separately authorized change phase.

1. Resolve the artifact and actual comparison base. Include staged, unstaged, and untracked contents for working-tree review; inspect full hunks and callers. Resolve repository/remote identity before relying on PR metadata.
2. Establish expected behavior from approved requirements and current source. Trace client state → validation/permissions → business decisions/transactions → query → response → visible/persisted result. Inspect only existing layers.
3. For shared contracts, permissions, or persistent state, read [contract changes](../implement/references/contract-changes.md) and [API synchronization](../../areas/contracts/references/api-type-sync.md). TypeScript review uses [TypeScript guidance](../implement/references/typescript.md).
4. Challenge reachable failure paths. Authentication, migrations, contested designs, and consequential contracts need a distinct adversarial pass; use independent reviewers only when authorized and disclose self-review otherwise. Confirm candidates against callers, constraints, and practical proof; separate product questions from defects.
5. Run only task-appropriate read-only or isolated disposable checks after inspecting setup. Review does not authorize fixes, shared-data changes, migrations, seeds, restarts, generation, commits, pushes, merges, or deployments.
6. Deliver confirmed actionable findings first: priority, precise location, trigger, violated expectation, consequence, and evidence. Cite the responsible changed line for diff findings. Separate questions and skipped/unavailable checks. If none qualify, say “No actionable findings” and state coverage and limits.

Use the reference's P0–P3 impact scale. Reject preference-only nits, speculative inputs, duplicates, and concerns prevented by an established boundary. Inspect helper claims yourself; resolve disagreements from evidence rather than votes.
