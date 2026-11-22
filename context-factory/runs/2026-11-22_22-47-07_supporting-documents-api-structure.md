# Supporting Documents API structure

Started: 2026-11-22T22:47:07+08:00
Updated: 2026-11-22T22:56:37+08:00
Status: complete
Scope: Refactor the Supporting Documents API and shared background jobs in the current worktree.
Checkout: `main` at `b08fd6cb` with the feature and refactor uncommitted.
Continues: [Admin supporting documents](2026-11-22_22-05-27_supporting-documents.md).

## Goal

Make document operations and queue transitions easy to follow using the same controller, service, and data layout as neighboring domains.

## Result

- The [document router](../../apps/api/src/controllers/supporting-documents/index.ts) registers separate list, upload, and retry operations. Document services own workflow and transactions, and document data files own the queries.
- [Worker polling](../../apps/api/src/services/background-jobs/run-worker.ts) and [execution of a single job](../../apps/api/src/services/background-jobs/run-one-background-job.ts) have separate entry points. Queue callers import their named transitions directly. Message data owns recovery checks for replies that already committed.
- [PDF reading order](../../apps/api/src/services/supporting-documents/page-reading-order.ts) is separate from block and section assembly.

## Decisions

The upload and retry caps use exact endpoint matches. The former wildcard applied the 16 KiB retry cap to uploads, which rejected PDFs that were within the documented upload limit.

## Verification

Supporting Documents (11), background jobs (11), catalog knowledge (57), image processing and migration (24), and local Edge (12) tests passed. The document suite uploads a valid PDF over 16 KiB to verify the fix. API type checking, scoped lint, and the Edge build passed. `pnpm test:guidance` passed. `pnpm check:guidance` still reports two broken links in an older proposal run.

## Remaining work

Hosted validation is outside this run. The refactor required no migration.

## Resume here

Start at the [document router](../../apps/api/src/controllers/supporting-documents/index.ts) for the API and at [one-job execution](../../apps/api/src/services/background-jobs/run-one-background-job.ts) for the worker. The local admin page is `/app/ai/documents`.
