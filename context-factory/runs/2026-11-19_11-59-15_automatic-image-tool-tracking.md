# Automatic image tool tracking

Started: 2026-11-19T11:50:00+08:00
Updated: 2026-11-19T11:59:15+08:00
Status: complete
Scope: User-authorized automatic image interpretation as an audited SDK tool. No commit, push, hosted deployment, or paid model call.
Checkout: main at ebb4263; preserve existing conversation-image and unrelated catalog changes.
Continues: [Conversation image messages](2026-11-19_11-38-25_conversation-image-messages.md)

## Goal

Retain mandatory image interpretation for customer, admin, and guest sends while making executions inspectable through the existing tool-call records.

## Result

Message preparation automatically invokes the `interpretMessageImage` SDK tool. The configured vision model still receives the original; conversation AI still receives only saved observations. AI-off sends, takeover, guest limits, and saved-request replays preserve their existing behavior.

## Changes or findings

- The adapter records start before vision work and success or sanitized failure afterward. Logs contain bounded metadata, observation counts, and a hash rather than image bytes, Storage keys, or observation text.
- Additive Prisma migration `20261119035635_track_image_interpretation` supports conversation-scoped attempts before a message exists and an optional human source-message link. Existing chat tools retain required customer-message and same-conversation reply checks.
- Image inserts and exact-one successful audit links commit in the same message transaction. Unsaved failures remain conversation-scoped; successful vision work followed by a later failure remains an unlinked success. Tracking failures prevent message persistence.

## Decisions

The [README](../../README.md#booking-requests-and-messages) and [AI execution standards](../areas/ai/references/standards-and-verification.md#tool-call-persistence) document automatic execution separately from optional model-selected chat tools. Records remain server-only; this change adds no trace UI.

## Verification

Final integrated verification passed 97 tests across image, audit, assistant, proposal, message, guest, and Edge suites using disposable databases and simulated providers. API types, Prisma validation, and Edge build passed. Independent Sol review found no actionable issues. The migration replayed on a disposable database, generated types there, and was applied to the verified local development database.

## Remaining work

No required implementation remains. Live-provider quality and hosted rollout remain unverified. Existing cross-worker duplicate vision work and best-effort object cleanup limits remain.

## Resume here

Inspect `services/ai/tools/interpret-message-image.ts`, `data/messages/message-images.ts`, and `tests/chat-images.test.ts`. Read the predecessor for original image behavior and browser evidence.
