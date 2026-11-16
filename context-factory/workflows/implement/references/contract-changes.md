# Blast radius


Use for shared packages, HTTP contracts, schema/column changes, permissions, persistent state, or a small diff whose indirect effects are uncertain. A caller list is the start, not completion.

1. Resolve the actual change and baseline. Read added, changed, and deleted behavior plus surrounding code.
2. State the one or two facts the change's safety depends on. Seek disconfirming cases.
3. Follow beyond symbol search: JSON fields, units/nullability, stored rows, migrations, snapshots, auth role checks, polling/cursors, catalog media references, effect cleanup, and deployment timing. Inspect pinned dependency source when behavior depends on a library.
4. Prove the decisive fact as far as practical: source location → explicit failure-path walkthrough → executable check against real code → running-app reproduction. Name the level reached. A convincing paragraph is not proof.
5. Keep confirmed risks separate from cleared cases and unresolved questions. Each risk names reachable conditions, consequence, source, and cheapest useful check. Mark an unproven safety fact as unproven.
6. Hand the evidence to [interrogate](../../review/SKILL.md) when review is requested or a wide analysis needs a separate review pass. When already part of a review, return to that lead rather than recursively reviewing the same artifact.

Clemora's critical seams are in [API synchronization](../../../areas/contracts/references/api-type-sync.md), [database guidance](../../../areas/api/references/database-and-migrations.md), [client data/auth](../../../areas/frontend/references/data-and-auth.md), and [packages](../../../areas/packages/SKILL.md). In particular, inquiry package details follow the referenced catalog record while saved quotation amounts survive catalog changes, hidden controls do not authorize API writes, and media cleanup must account for every live reference.

Read-only reviews use isolated scratch proofs without tracked writes, migrations, or shared-data mutation. Report the changed behavior, decisive safety fact and proof, confirmed risks, cleared cases, and remaining verification.
