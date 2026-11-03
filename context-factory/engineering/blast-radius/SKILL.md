---
name: blast-radius
description: "Trace downstream Clemora consumers and prove the key fact that makes a shared change safe."
---

# Blast radius

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use for shared packages, HTTP contracts, schema/column changes, permissions, persistent state, or a small diff whose indirect effects are uncertain. A caller list is the start, not completion.

1. Resolve the actual change and baseline. Read added, changed, and deleted behavior plus surrounding code.
2. State the one or two facts the change's safety depends on. Seek disconfirming cases.
3. Follow beyond symbol search: JSON fields, units/nullability, stored rows, migrations, snapshots, auth role checks, polling/cursors, catalog media references, effect cleanup, and deployment timing. Inspect pinned dependency source when behavior depends on a library.
4. Prove the decisive fact as far as practical: source location → explicit failure-path walkthrough → executable check against real code → running-app reproduction. Name the level reached. A convincing paragraph is not proof.
5. Keep confirmed risks separate from cleared cases and unresolved questions. Each risk names reachable conditions, consequence, source, and cheapest useful check. Mark an unproven safety fact as unproven.
6. Hand the evidence to [interrogate](../interrogate/SKILL.md) when review is requested or a wide analysis needs a separate review pass. When already part of a review, return to that lead rather than recursively reviewing the same artifact.

Clemora's critical seams are in [API synchronization](../../shared/api-type-sync.md), [database guidance](../../api/reference/database-and-migrations.md), [client data/auth](../../frontend/reference/data-and-auth.md), and [packages](../../packages/SKILL.md). In particular, old inquiry snapshots must survive catalog changes, hidden controls do not authorize API writes, and media cleanup must account for every live reference. Do not assume source-project queues, Redis, or payment webhooks exist here.

Read-only reviews use isolated scratch proofs without tracked writes, migrations, or shared-data mutation. Report the changed behavior, decisive safety fact and proof, confirmed risks, cleared cases, and remaining verification.
