# Automatic text replies in Messages

Started: 2026-11-16T14:21:59+08:00
Updated: 2026-11-16T14:21:59+08:00
Status: complete
Scope: User authorized the simplest functional customer message → conversation history → text reply pipeline; no tools, retrieval, decision calls, or handoff.
Checkout: feat/ai, aed6d03; existing AI guidance, README reference, routing, and API environment-example edits preserved.
Continues: [AI domain guidance](2026-11-16_13-47-50_ai-domain-guidance.md)

## Goal

Automatically reply to accepted customer messages using the saved history of the same conversation, and display persisted assistant messages in the existing UI.

## Result

The customer send operation saves its message, awaits `runAssistantTurnService`, and returns the saved message plus an assistant message or sanitized failure outcome. The configured `TEXT_MODEL` uses AI SDK/Gateway; admin sends do not generate replies.

## Changes or findings

- Added the AI entry, text-model configuration, prompt, ordered history query, and assistant persistence operation. Server-bound customer scope is checked before history access and again before reply persistence.
- Created/applied additive migration `20261116061207_add_ai_message_replies` to the configured local database, and regenerated Kysely types. Assistant rows have null sender IDs; human rows still require IDs. Existing messages/lifecycle are preserved.
- Updated DTO/OpenAPI/browser contracts, customer unread/read behavior, both send paths, and polling merges. Existing shared Button pending state and message bubbles are reused.
- Configured the ignored local Edge environment with existing AI settings and explicit local development origins, preserving other settings. Rebuilt/restarted its supervised function server.
- An unrelated toast-position edit appeared in `packages/ui/src/styles.css` during verification and was left untouched.

## Decisions

Generation stays outside transactions. History includes all messages through the triggering customer message, with an explicit 200,000-character budget, 30-second timeout, 800-token output limit, and no automatic retries. Concurrent requests are not serialized or durably retried. Failure preserves the customer message and does not invite resending.

## Verification

Passed: full `pnpm check`; Prisma validation and Edge build; 7 AI pipeline + 4 env tests; 9 Messages tests; 11 quotation tests; 18 web message tests; 3 Edge routing tests; guidance checks and 9 checker tests. Deterministic provider fixtures cover failures, cancellation, isolation, full history, and persistence. Four live synthetic DeepSeek turns passed through local Edge, including browser send-button/keyboard flows and remembered context. Independent Sol source review found no actionable findings. Temporary user/session/conversation fixtures were removed.

## Remaining work

No requested implementation remains. Production deployment and Gateway dashboard logs were not verified. Tools, retrieval, handoff, strict concurrent-turn ordering, and durable retry/idempotency remain outside this slice.

## Resume here

Inspect `services/ai/run-assistant-turn.ts`, the Messages send operation, and current Git state before extending behavior. Keep the pre-existing guidance/environment edits and do not commit or deploy without a request.
