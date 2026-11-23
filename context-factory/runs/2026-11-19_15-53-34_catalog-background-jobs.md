# Catalog background jobs

Started: 2026-11-19T15:42:46+08:00
Updated: 2026-11-19T15:53:34+08:00
Status: complete
Scope: Authorized durable background jobs for automatic package/service create and update embeddings, including photo widgets; retain manual Knowledge Catalog indexing.
Checkout: main at 393a5e3; existing uncommitted jobs migration/model integrated, no commits made.
Continues: [Index pending knowledge](2026-11-18_21-10-22_knowledge-index-pending.md)

## Goal

Save catalog listings without waiting for embeddings, process durable jobs every three seconds, centralize typed payloads and execution policy, and teach future contributors through a discoverable skill.

## Result

Implemented atomic save/enqueue, a separate Node runner, typed embedding handlers, local startup integration, and the [background-jobs skill](../areas/background-jobs/SKILL.md), discoverable through `.agents/skills/background-jobs/SKILL.md` and the task router. Manual Index pending and CLI backfill remain unchanged.

## Changes or findings

- `services/background-jobs/job-definitions.ts` owns polling, strict UUID schemas, handler references, deduplication, retry delays, timeouts, concurrency, and lease settings. Queue SQL stays under `data/background-jobs/`; the executable entry stays under `workers/`.
- Short serialized queue transitions fence ownership and recover interrupted attempts. Pending successors survive older failed work. Retry-policy reductions and uncooperative handlers have regression coverage; cancellation still requires handlers to honor signals before side effects.
- Removed automatic in-memory scheduling and its await environment setting. Media promotion/cleanup keep their existing lifecycle.
- Generated Kysely types from all 68 migrations in a disposable database. Applied only the new additive jobs migration to the inspected local application database; no reset or remote deployment.

## Verification

Passed 10 queue/worker tests, 45 catalog-knowledge tests, 36 package tests, 3 RLS tests, 8 Edge tests after reloading the current bundle, 3 local-worker environment tests, and 9 guidance unit tests. API types, Prisma validation, Edge build, environment boundary check, skill validation, scoped formatting, and diff whitespace checks passed. Save integration tests force enqueue failure and prove all four save paths roll back catalog, media, knowledge, and job changes. Real worker-process tests verify repeated polling and SIGTERM shutdown. Providers are synthetic.

## Remaining work

Hosted rollout and live provider quality are unverified. `check:guidance` retains two baseline missing links in the conflict-marked runs index; those unrelated entries were preserved. No UI changes were needed.

## Resume here

Review the diff and run `pnpm dev` or `pnpm all` to start the matching worker. Follow the skill before adding job types or altering retry/recovery semantics.
