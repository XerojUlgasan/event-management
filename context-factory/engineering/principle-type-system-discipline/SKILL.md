---
name: principle-type-system-discipline
description: "Derive types from their owners and model valid states without type assertions that conceal missing proof."
---

# Type system discipline

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use authoritative route schemas, shared catalog/limit contracts, and generated Kysely table types. Infer from Zod or existing types rather than maintaining a parallel interface where an owner exists. Explicitly compare handwritten browser DTOs where generation does not exist.

Parse unknown external data at the relevant boundary. Narrow variants and make switches exhaustive. Use semantic types or validated brands where mixing otherwise identical primitives creates a real risk; do not introduce brands across the whole repo without a need.

Prefer the simplest type whose operations are total. Use satisfies for compile-time shape checks and actual parsing for runtime validation. Avoid new any, non-null assertions, or as casts that hide uncertainty. Existing assertions are technical debt, not proof of safety or a reason for an unrelated sweep. Read [TypeScript best practices](../typescript-best-practices/SKILL.md).
