---
name: interrogate
description: "Review Clemora diffs or designs without editing, tracing contracts and confirming actionable findings."
---

# Interrogate

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

This workflow adds target resolution and risk review to the canonical [code-review reference](../../agents/senior-developer/reference/code-review.md). Read that reference and every affected area skill before reviewing. Review mode remains read-only even when fixes are also requested; accepted findings move to a separate authorized implementation step.

## Resolve and trace

Identify the PR/branch/range/patch/working-tree or design and the actual comparison base. Include staged, unstaged, and untracked files for a working-tree review. Read full relevant hunks and callers; do not mistake a branch diff for all local work. Resolve remote identity before using PR metadata. No source-project collector is installed here; use Git and inspect untracked contents directly.

Establish intent from trusted requirements and current scope. Trace permissions, field units/nullability, transactions, snapshots, archives, media references, error states, and UI consumers. For contract changes, use [API synchronization](../../shared/api-type-sync.md). For shared or persistent changes, run the [blast-radius method](../blast-radius/SKILL.md) and record the decisive safety fact and proof level. A design without code gets a concrete invariant or violating schedule, not invented runtime proof.

## Review and judge

Use a lead pass for ordinary work. For authentication/authorization, migrations, confirmed contract changes, contested designs, or an explicit adversarial request, add a distinct pass challenging assumptions and failure paths. Use independent read-only reviewers only when delegation is authorized; otherwise disclose sequential self-review. Do not claim multi-model agreement or independence that did not occur.

Confirm every candidate against reachable inputs, current callers, constraints, and a practical check when possible. Dismiss preference-only changes, unsupported hypothetical inputs, speculative abstraction requests, duplicates, and concerns prevented by an established boundary. Preserve unresolved product questions separately; inquiry acceptance is not booking confirmation.

Map confirmed impact consistently:

- P0: active compromise, catastrophic data loss, or systemic outage.
- P1: serious authorization, privacy, integrity, migration, or release-breaking defect.
- P2: material functional, accessibility, performance, or reliability defect.
- P3: concrete localized defect with limited impact.

Inspect the artifact behind helper claims yourself. Resolve disagreements from source and evidence, not votes. Do not inflate nits to fill a report.

## Verify and report

Use applicable read-only checks and isolated scratch proofs. Do not run fixes, seeds, migrations, service restarts, tracked generation, commits, pushes, merges, or deployments from review. Inspect test setup: an integration suite may mutate even when the reviewer intends only to inspect. Report unavailable, skipped, baseline-failing, or warning-bearing checks distinctly.

Publish actionable findings first with impact, precise source location, reachable trigger, expected rule, and evidence. For a diff finding, cite the responsible changed line; an unchanged consumer can demonstrate the consequence. Keep questions separate. If none qualify, say “No actionable findings,” state coverage, and name meaningful verification limits. Review is evidence about the examined scope, not a guarantee of general correctness.
