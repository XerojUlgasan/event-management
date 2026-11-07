---
name: principle-model-the-domain
description: "Represent real states and invariants explicitly instead of growing scattered branches or synchronized booleans."
---

# Model the domain

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use a discriminated union, transition table, reducer, registry, or domain module when it removes invalid combinations or repeated decisions. Start from the actual reads, writes, and invariants; do not force an abstraction onto clear local code.

For Clemora, booking-request review status, conversation expiry, archive visibility, and catalog optimistic concurrency are different concepts. Make an explicit choice between snapshotting catalog values and joining current catalog records. Booking requests use the current linked package, so its values may change on existing request responses. Accepted inquiries do not reserve dates, and a venue record does not prove availability.

Derive the model from current schemas, migrations, services, and approved requirements. Ask about unresolved business policy rather than encoding a guess in a state machine. Prefer one owner for a rule to branches repeated in UI and services.
