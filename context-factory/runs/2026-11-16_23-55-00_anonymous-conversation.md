# Anonymous conversation and account claim

Started: 2026-11-16T23:55:00+08:00
Updated: 2026-11-17T00:10:04+08:00
Status: complete
Scope: Approved guest-chat implementation and local verification. No commit, push, or hosted deployment requested.
Checkout: main at 315595d; initially clean. Completed changes remain uncommitted.
Continues: [Conversation AI toggle](2026-11-16_16-41-39_conversation-ai-toggle.md)

## Goal

Replace Meet Styled by AMAC with Chat with us, remove public Get started, and persist anonymous bookingless conversations before sign-in. Allow five customer messages, then claim the same thread after login.

## Result

Public chat, guest ownership, transactional quota/replay handling, inactivity expiry, and account continuation are implemented. The reviewed additive migration `20261116155140_anonymous_guest_chat` was applied to the confirmed local database. Generated Kysely types came from a migrated disposable database. Admin inboxes include guests and preserve human takeover.

## Decisions

The latest user instruction supersedes the fixed-age suggestion: reuse one unexpired conversation per guest identity until 24 hours pass without customer, admin, or assistant messages. Reads and AI toggles do not extend it. Expiry allows a new thread with five messages. Claiming preserves IDs/history, revokes guest access, and adopts the signed-in lifecycle.

Server-owned history and a hashed opaque cookie avoid importing browser transcripts or copying messages on claim. The cookie lasts 30 days independently of thread inactivity. Web Locks serialize initial bootstrap across supported tabs; server locks serialize requests sharing a capability. Cookie loss, another browser, or first openings without Web Locks can create different identities. This is not physical-device tracking.

## Verification

- Workspace `pnpm check` and builds passed; final web build repeated after the admin guest-header correction. The existing bundle-size advisory remains.
- API regressions: 58 passed across guest chat, messages, AI, bookings, quotations, and RLS. Auth emulator: 17 passed, including registration/password/Firebase claims. Edge: 7 passed. Web: 24 passed. Guidance: 9 passed. Navigation, design, structure, Prisma validation, and Edge build passed.
- Browser with actual API, disposable PostgreSQL, and synthetic model verified desktop/mobile entry, reuse, fifth reply/gating, provider failure, expiry, registration claim, sixth send, failed-claim recovery, selected threads, logout isolation, and admin takeover. Database checks confirmed preserved IDs/provenance, removed deadline, and revoked guest ownership.
- Served Edge bootstrap/reuse/read matched the configured database. All task fixtures, browser accounts/sessions, servers, and tabs were removed; viewport reset. Independent Sol review found no actionable issues.

## Remaining work

Local implementation is complete. Live provider and hosted rollout were not exercised. Interrupted AI turns retain their saved message and deduplication reservation without repeating provider calls. Screenshots are in this chat's visualization folder.

## Resume here

Review guest-chat controllers/data/services and PublicChat. The [message policy](../business/messages.md#anonymous-inquiries-and-account-claim) and root README own current behavior. Commit or hosted deployment remains separate.
