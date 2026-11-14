# Implementation principles

Read for implementation/refactoring; apply the sections relevant to a review. These consolidate the former individual principle skills. Standing authority, investigation, and delivery rules live in [AGENTS.md](../../../../AGENTS.md).

## Ownership and valid state

- Establish data shapes, owners, dominant reads/writes, invariants, and concurrent actors before dependent logic. Keep HTTP mapping, business decisions/transactions, and SQL at their established owners.
- Parse untrusted inputs at their owning boundary. Route validation does not replace authorization, ownership, stale-update checks, current-state checks, stored JSON validation, or provider-response validation.
- Use authoritative schemas/contracts and generated DB types. Represent real variants/transitions explicitly and derive state rather than synchronizing copies. Browser request generics do not validate response JSON; see [TypeScript](typescript.md).
- Keep inquiry review, conversation state, archive visibility, optimistic concurrency, snapshots, and mutable proposals distinct. Resolve business-policy uncertainty through the [domain owner](../../../business/README.md).

## Small, complete changes

- Prefer deletion of supported obsolete paths, nearby patterns, local state, and one canonical owner per decision. Keep meaningful boundaries; a short file does not justify mixing SQL with UI or deleting permission checks.
- Add a reusable abstraction/dependency only for an established responsibility. Each boundary should hide a decision rather than forward unchanged arguments. Check where values come from and what can change them.
- Preserve the complete requested outcome. A small workaround that leaves its cause or required consumers broken is insufficient. Repeated casts, synchronized state, or callers coordinating private stages warrant [design reconsideration](../../investigate/references/design.md).
- Give loading, empty, invalid, failed, and successful journeys clear feedback. Check keyboard/mobile/rendered behavior when relevant; implementation convenience alone does not establish a usable result.

## Concurrency, replay, and migration

- Give independent writers separate targets. Enforce genuinely shared invariants with transactions, constraints, locks, compare-and-swap, or a single owner. Inspect a violating concurrent schedule and interruption recovery.
- For repeatable operations, test the second run and partial failure. Transactions prevent partial writes; they do not alone deduplicate a request whose response was lost. Preserve intentional separate customer actions rather than guessing they are replays.
- Inventory consumers before changing a contract. Migrate implementation, shared types, browser calls, tests, examples, and docs coherently, then remove obsolete APIs. Independently deployed consumers need a coordinated or bounded compatible rollout and a deletion step. Preserve applied migration history.

## Evidence and repeated work

- Test public behavior: returned values, errors, cookies, persisted state, visible outcomes, and boundary effects. A test should reject a wrong/skipped/duplicated result and survive an equivalent internal refactor. Mocks establish their boundary, not the real provider.
- For complex/repeated edits, build the smallest rerunnable tool, compare its result with one inspected example, then apply it safely. Prove a checker rejects the actual mistake and accepts a valid case; avoid infrastructure for a few obvious edits.
- Repair recurring demonstrated mistakes through ownership, types, actionable checks, or behavior tests before adding prose. Use the [retrospective](../../investigate/references/retrospective.md) for evidence-backed lessons.
- A performance claim needs completed/correct work, a real limiter, comparable tuning, units, repeated runs, and spread; use [benchmarking](../../qa/references/benchmark.md). Missing proof makes the result inconclusive.
