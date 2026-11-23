# Image-only conversation jobs

Started: 2026-11-19T19:28:06+08:00
Updated: 2026-11-19T19:34:21+08:00
Status: complete
Scope: User-authorized image-only queue refactor and clear naming; leave uncommitted, with no shared database changes, worker restart or real provider calls.
Checkout: main at 4131b0d; preserves the pre-existing uncommitted image feature and durable-processing work.
Continues: [Local message schema repair](2026-11-19_19-19-19_local-message-schema-repair.md)

## Goal

Queue only image-containing messages under `process_image_message`; restore synchronous customer/guest text replies and verify mixed image/text behavior, retry, takeover and scope.

## Result

Image-only job refactor, current documentation, integration checks and independent review are complete. All changes remain uncommitted.

## Changes or findings

- Image sends atomically enqueue their job; the renamed `process-image-message.ts` handler interprets images and generates an eligible reply. Admin and AI-disabled images interpret only. A job without attachments fails before invoking a model.
- Text-only sends never create jobs. They wait up to five seconds for earlier pending/running image jobs before calling the assistant inline. Timeout leaves the text saved and returns `assistantError`; no text job is created.
- Internal image-job enqueue, payload, lease and loader names now identify image work. Public processing DTOs and retry routes stay compatible with existing web consumers.
- Additive migration `20261119112935_image_message_jobs_only` renames saved image jobs, retires pending/running legacy text jobs with revoked leases, and preserves messages, attachments and completed history. Guest replay records retain saved replies or a saved-message error. No schema/type regeneration is needed for this data-only migration.

## Decisions

The wait covers earlier image jobs; concurrent inline text turns and later image jobs retain their existing overlap. An older image retry may overlap a later inline reply until that reply commits. No new processing table or durable text marker was added.

## Verification

- Disposable/synthetic API suites: messages and populated migration 32, guests 19, assistant 43, background jobs 10, Edge routing 5 passed. API/web type checks and Edge bundle passed; 28 web message consumer tests passed.
- Independent Sol review found no actionable findings. Terra implemented backend, Luna updated current docs, and the lead integrated migration and checks.
- Scoped ESLint, diff whitespace and guidance checks passed; nine guidance tests passed. Walked affected API, AI, TypeScript, migration, message behavior, documentation and continuation routes. No UI code changes were needed for this refactor.
- No browser-to-running-API journey, real provider, application migration or hosted deployment was exercised.

## Remaining work

Rollout remains separate: stop the old worker, apply the additive migration, and deploy matching API/worker together. Live provider and hosted behavior remain unverified.

## Resume here

Inspect this run and current source before continuing. Preserve all uncommitted work; do not start a shared worker to run tests.
