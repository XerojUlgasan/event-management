# In-app notification bells

Started: 2026-11-21T12:13:39+08:00
Updated: 2026-11-21T12:27:08+08:00
Status: complete
Scope: Implement and locally verify notification bells for both signed-in workspaces.
Checkout: initially clean `main` at `692eb5e`. Changes are uncommitted.
Continues: [Realtime message bubbles](2026-11-21_02-35-00_conversation-realtime.md).

## Goal

Deliver four notification types with a shared validated payload and timestamps, independent read state for each recipient, exact destinations, and live updates through the existing Realtime token endpoint.

## Result

Booking creation and successful customer or guest handoff write a notification for each current System Administrator. Admin status changes and sent quotation versions notify the owning customer. Domain writes and notification inserts commit together. The private notification channel signals changes after commit. The HTTP API owns the cursor, list, unread count, and mark-read operation.

The bell reuses the existing Button, Icon, Badge, Drawer, and theme tokens. Workspace actions and live subscription state live in the web app. Customer booking and quotation links open the matching details, and administrator links open the exact booking or conversation. See the [README](../../README.md#in-app-notifications) for behavior and [migration impact](../../README.md#migration-impact).

## Verification

Both migration checksums matched a fresh disposable Supabase replay. Against the matching Edge build and Chromium, all four alert journeys opened their intended destinations, including a superseded quotation and a simulated AI handoff. The browser verified keyboard focus return, mobile destinations, same-page Back, and booking detail retry. Live refresh preserved loaded older rows and propagated their read state. After a forced disconnect, the badge recovered on rejoin with polling disabled. Actual Realtime joined the two authorized scopes and denied another user's channel, cross-scope tokens, anonymous access, and a revoked session.

Passed 79 API and PostgreSQL cases, 25 focused web tests, lint, web and UI checks, both builds, and guidance checks. Independent review cleared the final diff after two repair cycles. The existing `PoolClient.processID` API test type error and unrelated web structure and design violations still reproduce. The AI handoff used a synthetic tool execution. The configured application database and hosted services were outside the test scope.

## Resume here

Apply both notification migrations and the matching web and API builds when rollout is authorized. Follow the [Realtime configuration](../../README.md#configuration) for the target Supabase project.
