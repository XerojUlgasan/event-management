---
name: principle-foundational-thinking
description: "Choose data ownership, types, and access patterns before writing dependent logic."
---

# Foundational thinking

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Establish the data shape, owner, dominant reads/writes, and invariants before implementing logic. Ask what happens when another actor changes the same state concurrently. Isolate independent state; enforce genuine shared invariants structurally.

Remove obsolete paths within scope, then build the small shared foundation that later work actually needs. Do not add CI, libraries, or a framework merely because they could help some future feature. Keep similar local statements when an abstraction would add indirection without owning a rule.

In Clemora, distinguish Prisma/migration schema ownership, Kysely queries/types, API schemas, shared contracts, and browser state. A domain type must not invent a booking-confirmation or availability policy still listed as open in the README.
