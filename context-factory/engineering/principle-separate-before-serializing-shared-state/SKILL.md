---
name: principle-separate-before-serializing-shared-state
description: "Isolate independent mutable state and enforce genuine shared invariants structurally."
---

# Separate before serializing shared state

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Inventory concurrent writers to files, branches, browser sessions, database rows, or state objects. If they publish independent facts, give each its own owned target and combine only for reading/reporting.

When one shared object is a real domain requirement, enforce access with a transaction, uniqueness constraint, compare-and-swap, lock, or single writer as appropriate. An instruction saying “do not race” is not concurrency control. Check the actual concurrent schedule and recovery after interruption.

In Clemora, inspect catalog row locking and expectedUpdatedAt handling before changing simultaneous-save behavior. Future booking-conflict prevention requires approved confirmation rules and database-level enforcement; it cannot be claimed from current inquiry storage. Serialize shared Git mutations and browser use when helpers are authorized.
