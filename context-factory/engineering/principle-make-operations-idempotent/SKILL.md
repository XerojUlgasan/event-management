---
name: principle-make-operations-idempotent
description: "Define retry, interruption, and duplicate behavior for repeatable writes and processing."
---

# Make operations idempotent

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

For an operation that can retry or resume, ask what happens after a second run and after a crash at each consequential step. Reconcile current durable state with the goal instead of trusting a previous run's intention. Use transactions, uniqueness, idempotency keys, or atomic replacement where the domain requires them.

Distinguish an intentional second action from a replay. Do not deduplicate separate customer inquiries by guessing intent. A transaction prevents partial writes; it does not alone prevent duplicates after a response is lost.

For Clemora, inspect the seed's insert-only behavior, catalog stale-update contract, message sends, and booking-request writes before claiming retry safety. Recognize and recover stale locks or temporary artifacts when designing a new process. Preserve approved semantics and verify the actual second-run or partial-failure path.
