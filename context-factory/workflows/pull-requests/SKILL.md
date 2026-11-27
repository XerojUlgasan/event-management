---
name: pull-requests
description: Prepare, split, stack, open, or land authorized AMAC PR work with coherent contracts and verified scope.
---

# Pull requests

Use when PR work is requested or already authorized. Implementation alone does not authorize branches, commits, publication, merges, or deployment.

1. Resolve the repository, active checkout, dirty work, and requested/default base from actual Git/remote state. New agent branches use `codex/` unless instructed otherwise.
2. Inspect the complete intended diff, including relevant untracked contents. Review generated files as well as handwritten changes. Keep tests, generated contracts, and docs with the behavior they support.
3. Prefer one coherent unit readable in one sitting. Split independent behavior when useful; keep inseparable schema/API/browser changes together or define a bounded compatible rollout. Do not deliver a broken unit or failing test alone. One PR does not make separate deployments atomic.
4. For stacks, order dependent units bottom-up and set actual bases explicitly. Independent units branch separately from the base. Serialize rebases/shared Git writes; no stack extension is required.
5. Run affected checks, [review](../review/SKILL.md), and [contract-change analysis](../implement/references/contract-changes.md) where relevant. Use [technical writing](../documentation/references/technical-writing.md): lead the title/body with the problem and resulting behavior, then meaningful changes, dependencies, validation, risks, and rollout needs. Use an existing repository template.
6. When publication is authorized, verify the target/base/head and read back the resulting PR. Preparing or opening does not authorize merging.
7. For authorized landing, immediately recheck exact PR URL, current head/base/checks, and requested merge scope. Land parents before children; recheck child bases/diffs after synchronization. Report actual landed work and remaining proof limits. Shared stack membership does not authorize additional merges.
