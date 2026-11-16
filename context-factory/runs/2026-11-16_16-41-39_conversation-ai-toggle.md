# Conversation AI toggle and human takeover

Started: 2026-11-16T16:41:39+08:00
Updated: 2026-11-16T16:43:00+08:00
Status: complete
Scope: User approved the preceding read-only plan: per-conversation admin AI toggle, automatic human takeover on successful admin messages and quotations, and stale AI reply suppression. No commit or hosted deployment requested.
Checkout: feat/ai, 4c2032f; existing staged/unstaged catalog, pricing, and creation work preserved.
Continues: [AI message context](2026-11-16_14-53-07_ai-message-context.md), [Automatic text replies](2026-11-16_14-21-59_automatic-text-replies.md)

## Goal

Keep the UI simple while ensuring human takeover prevents unfinished AI replies from being saved.

## Result

Admin Messages has an AI on / AI off (Human) button in general and booking conversation headers. It reuses the shared Button toggle, pending state, notification feedback, existing header styles and theme tokens. Customers have no control; closed conversations disable it.

## Changes or findings

- Additive Prisma migration adds `ai_enabled` and `ai_version`. Applied to the confirmed local Clemora PostgreSQL; generated Kysely types refreshed.
- Customer insertion snapshots AI state under the conversation lock. Admin messages and quotation delivery atomically switch AI off. Final assistant persistence checks the captured version, so off/on cannot revive an old reply.
- Admin-only PATCH validates expected version; stale requests return 409. Updated API schemas, DTOs, browser calls, and polling merges preserve newer confirmed preferences.
- Current product and AI documentation describe the accepted behavior. Other dirty work is untouched.

## Decisions

AI defaults on for existing/new conversations; historical admin messages do not infer takeover. AI stays off through general-thread reopening. Enabling affects the next customer message; no backlog reply. Preference changes do not reorder the inbox. Provider work already started may complete, but its stale output cannot be saved.

## Verification

Passed full `pnpm check`, Prisma validation, Edge build, 33 API regressions, 19 web message tests, 7 Edge tests, and guidance checks/9 tests. A Terra helper independently reviewed backend production changes with no findings; its test edits were lead-inspected. Browser fixture used actual admin UI, Hono API, a disposable migrated database, and mock AI: manual/keyboard toggle, customer off/on sends, admin takeover, failure feedback, customer control absence, mobile layout, closed control. The fixture made one synthetic provider call; its database/server were removed. Local served Edge OpenAPI includes the PATCH route. No live-provider or hosted-deployment proof.

## Remaining work

Hosted migration/API/web rollout remains separate.

## Resume here

Review the scoped Messages/AI diff and migration before any requested commit/deployment. Start with `services/ai/run-assistant-turn.ts` and `data/messages/create-message.ts`; preserve unrelated catalog work.
