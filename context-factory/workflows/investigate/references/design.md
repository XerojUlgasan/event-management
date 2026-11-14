# Architect


Use when a new requirement could lock the code into the wrong shape. Routine changes with a clear precedent need only the existing pattern. A design-only request produces a design; it does not authorize implementation.

1. Ground the affected system with [how](../SKILL.md). Use [why](rationale.md) when changing an existing ownership decision. Read the affected area guidance and current callers, contracts, migrations, and tests.
2. Write the caller's intended usage first. Sketch types, signatures, ownership, and invariants from that usage. Keep incomplete code in scratch space.
3. Compare at least two structurally distinct candidates against concrete criteria: caller simplicity, valid states, ownership, concurrency, rollout, and verification. Use independent candidates only when delegation is authorized; otherwise compare sequentially and state that limit.
4. Reject candidates with duplicated state, broad interfaces hiding little logic, private stages exposed to callers, redundant wrappers, hand-synchronized lists, or two supported ways to do one task. Preserve Clemora's meaningful controller/service/data boundaries.
5. Select a base and incorporate specific useful ideas from the alternatives. Record the choice, rejected options, tradeoffs, caller example, and evidence needed. Do not average incompatible designs.
6. Implement when authorized, with scoped verification boundaries. If a checkpoint was requested, show the concrete design and stop before dependent implementation. Keep delivered units deployable and contracts/callers coordinated.
7. Treat repeated deviations, casts, synchronized state, or caller workarounds as evidence against the design. Re-ground and compare new shapes rather than patching around repeated friction.

Clemora constraints include Prisma/SQL migrations, Kysely data access, handwritten browser calls plus shared contracts, and React views hosted by Astro. Product policy still open in the README is a question, not a design assumption. Deliver the chosen shape and rationale, or the implementation and its actual proof, at the requested depth.
