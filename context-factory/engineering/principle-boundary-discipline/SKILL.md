---
name: principle-boundary-discipline
description: "Place parsing and validation at trust boundaries while preserving authorization and database invariants."
---

# Boundary discipline

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Parse untrusted HTTP input through the owning route schema and use validated values in handlers. Keep transport adaptation in controllers, business decisions and transactions in services, and Kysely queries in data. Extract pure decision functions when that makes the rule independently testable.

Do not repeat field validation deep in typed internal calls. Trust a value only for the properties its boundary actually established. Authorization, ownership, stale-update checks, current database state, persisted JSON, and external-provider responses are separate boundaries or invariants; do not delete their checks because a request passed Zod.

The browser's handwritten request generic does not validate response JSON. Shared wire types deliberately belong in contracts; preserve that owner rather than concealing it behind duplicate types. Read [API synchronization](../../shared/api-type-sync.md).
