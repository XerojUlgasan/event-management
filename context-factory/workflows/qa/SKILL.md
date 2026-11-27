---
name: qa
description: Authenticate local AMAC API checks, inspect PostgreSQL read-only, verify behavior, extend one-table seeds, or benchmark a measured claim.
---

# QA

Use for behavior checks and evidence. Confirm the actual checkout, process, API/database target, roles, and available setup before execution. Read [API verification](../../areas/api/references/verification.md) for integration suites and [frontend verification](../../areas/frontend/references/styling-and-verification.md) for browser/UI claims.

## Choose the procedure

| Need | Read |
| --- | --- |
| Choose a local login | [Fixture accounts](references/accounts.md) |
| Obtain and clean up API sessions | [Session procedure](references/sessions.md) |
| Discover schema or run custom read-only SQL | [PostgreSQL queries](references/pg-query.md) |
| Add seeded rows for one table | [Seed one table](references/seed-a-table.md) and [seed coverage](../../../docs/SEED.md) |
| Compare performance or report measurements | [Benchmark](references/benchmark.md) |

## Collect useful evidence

1. State the claim, expected result, relevant role/input, and check that could disprove it. For behavior changes, cover meaningful invalid, failed, stale/concurrent, and success cases from the affected contract.
2. Inspect test setup and side effects. Prefer existing focused tests and disposable fixtures; review-only work does not authorize shared-data writes, resets, migrations, or restarts. Do not alter another user's records.
3. Inspect actual output and, when persistence is claimed, read back the saved result. Direct SQL checks DB access; it does not impersonate an application role. Browser permission controls require authenticated API proof too.
4. Record result, artifact/environment, evidence, and gaps in the [run](../../runs/README.md) or a substantial [verification record](../../history/verification/README.md). Clean up only task-created fixtures/sessions and record any remaining side effects.

Source, types, tests, API responses, DB rows, browser journeys, emulators, and real providers establish different boundaries. Simulated responses/fake storage do not prove live providers. If setup is unavailable, report the gap rather than turning it into a pass.
