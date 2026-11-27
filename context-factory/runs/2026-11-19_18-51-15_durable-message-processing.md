# Durable message processing

Started: 2026-11-19T18:51:15+08:00
Updated: 2026-11-19T19:14:00+08:00
Status: complete
Scope: User-authorized background interpretation and conversation replies, visible progress, safe retry, and verification. Leave changes uncommitted; no paid provider calls or hosted deployment.
Checkout: main at 4131b0d; preserve the 64 uncommitted paths imported from feat/customer-send-images at b7aa5e8 and existing Markdown/catalog jobs.
Continues: [Automatic image tool tracking](2026-11-19_11-59-15_automatic-image-tool-tracking.md)

## Goal

Accept private attachments and human messages before automatic interpretation, execute durable Node jobs, and publish only to the original server-bound conversation. Prove atomic enqueue, replay safety, conversation ordering, cancellation/takeover, visible states, and retry without another upload.

## Result

Implemented the simplified durable flow, with no separate processing table, image-status column or duplicated audit conversation ID. Progress derives from background_jobs and saved observations/replies. Backend and frontend owners integrated their changes; independent read-only review found no remaining actionable issue. All work remains uncommitted and unstaged.

## Decisions

- Keep no message_processing table or message_images.status column. Job payload holds server-bound message/conversation IDs and the captured nullable AI version; derive original identity from the saved human message. Image audits derive conversation through source_message_id. Keep unique reply_to_message_id.
- Use one job per saved message. All automatic customer/guest replies share the queued path, avoiding a race between synchronous text replies and later image jobs. Admin text remains immediate; admin image jobs interpret without requesting an assistant reply.
- Interpretation remains application-required, outside the chat agent's optional tool map. Progress is temporary application UI, not another model call or saved assistant acknowledgement.
- Preserve per-image observations across retries. Terminal failed images remain visibly failed, do not block the conversation forever, and cannot enter history as successful observations. An old failed turn retried after later replies must not publish an obsolete answer.
- Preserve historical migrations; generate an additive migration and Kysely types using a disposable database. Shared application migration and hosted rollout remain separate.

## Verification

- Fresh disposable migration replay, additive `20261119110919_durable_message_processing` deployment, generated Kysely types and Prisma validation passed. The shared application database was not migrated.
- Integrated backend suite passed 67 tests: messages, images (20), guests, queue/worker, Edge routing and RLS. Separate assistant-turn tests passed 44; proposal, catalog continuation and audit tests passed 14. Database tests use isolated disposable databases and synthetic Storage/AI providers.
- Web Astro check passed with zero errors; 30 focused web tests and 10 SSR Markdown/image/progress/permission tests passed. Web production build and Edge bundle passed; the existing large-chunk warning remains.
- Browser checks used the real components against a temporary synthetic Vite harness, not the running API: queued/interpreting/replying/completed states, failed retry with one retained upload, guest allowance unchanged, conversation switching, and 390px viewport. The narrow existing conversation header is cramped; the progress content remains visible.
- Scoped ESLint, diff whitespace and guidance checks/tests passed. Affected guidance routes were walked for UI reuse, message contracts, AI scope, API/database, background jobs, documentation and continuation.
- Existing unrelated checks remain failing: web structure flags React/data imports in `apps/web/src/lib/utils/catalog/use-thumbnail.ts`; design checks flag native button/dialog in `ThumbnailField.tsx` and literal colors in package-editor.css. These files were not changed.
- No real provider, live browser-to-API chain, shared application queue, hosted Edge or deployment was exercised. Vision calls are at least once if a process dies before persisting the observation.

## Remaining work

Apply the migrations to the intended application database and restart/redeploy the API and separately supervised worker together when rollout is authorized. The worker needs the same database, Storage and AI configuration. Representative live vision quality and hosted runtime verification remain deployment checks.

## Resume here

Implementation is complete and left uncommitted. Confirm Git/source and deployment target before any follow-up; do not recreate the rejected extra schema or rewrite the historical image migrations. The new additive migration removes the redundant audit conversation column. Never start a worker against shared queued jobs merely to run tests.
