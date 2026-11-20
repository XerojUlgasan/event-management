# Realtime message bubbles

Started: 2026-11-21T02:23:26+08:00
Updated: 2026-11-21T02:36:24+08:00
Status: complete
Scope: Live bubbles in open signed-in customer and admin conversations. The user approved implementation and isolated local verification.
Checkout: initially clean `main` at `0c6eadc`. Changes are uncommitted.
Continues: [Conversation activity](2026-11-20_20-50-42_conversation-activity.md).

## Goal

Render each saved message once in the recipient's open conversation, preserve read receipts, and recover through the 15-second refresh or a rejoin. Verify access and delivery on a local Supabase stack.

## Result

`em_session` authorizes the token endpoint and messaging API. A short-lived JWT is limited to one conversation. A receive-only RLS policy checks the conversation, current role and live application session at join or renewal. Message writers use the shared client-facing DTO and one validated database Broadcast publisher. The browser validates the inline event and merges by ID using the existing thread logic.

Read acknowledgements use the existing session and role rules and stop at the received message. A visible signed-in thread refreshes every 15 seconds and catches up on focus or rejoin. Inbox and guest polling retain their existing paths. Supabase-specific setup and the bounded session revocation window are documented in the [root README](../../README.md#configuration).

## Verification

Both migrations applied in a disposable Supabase project with matching checksums. Live socket tests allowed the owner and System Administrator and rejected another customer and client publishing. An actual local Edge function issued and used a scoped token, published a saved message and recorded a read acknowledgement.

Playwright exercised a desktop admin and a 390px customer. Both rendered one bubble with their thread GET blocked, and SQL confirmed their read acknowledgements. Blocking the customer WebSocket forced the 15-second refresh. Restoring it recovered another missed message ahead of the next scheduled poll.

Passed 43 API/environment tests, 70 web tests, 11 Edge tests, the web Astro check, Edge build, lint and environment check. Independent Sol review cleared two repair cycles and the final transport metadata fix. Workspace checking still reports two existing catalog import-boundary issues, and API types report the existing `PoolClient.processID` test error.

## Resume here

Use the [environment setup](../../README.md#configuration) and both additive migrations for the intended Supabase project. Hosted signing configuration and rollout remain unverified.
