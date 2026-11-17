# Conversation-based booking intake

Started: 2026-11-17T00:55:00+08:00
Updated: 2026-11-17T01:11:00+08:00
Status: complete
Scope: Approved implementation, local migration, and verification of conversation binding, optional package, and administrator preparation. No commit, push, reset, or hosted deployment requested.
Checkout: main at e6b110a; initially clean. Changes remain uncommitted.
Continues: [Instant conversation composer](2026-11-17_00-39-13_instant-conversation-composer.md)

## Goal

Preserve the existing chat when submitting a booking request, allow no initial package, and let an administrator attach a catalog package or build a private package from scratch. Verify ownership, concurrency, null displays, quotation guards, and guest continuation.

## Result

Implementation, integrated checks, cleanup, and final audit are complete. The single new migration was applied to the confirmed local Clemora database at port 54322; schema readback confirms nullable package ownership. No application records were modified there. Browser fixtures use a separate disposable migrated database.

## Changes or findings

- Requests bind their owned active conversation transactionally, preserving history and AI preference. Separate submissions still create a conversation. Catalog fields are nullable; the current private proposal retains its separate owner.
- Administrators assign catalog packages only when no proposal exists, or create/edit private packages. Quotations require a prepared package; booking confirmation and reservations remain separate.
- Reused shared controls, the request form, and package editor. Private editor copy and preview stay private. Independent Sol review found an account-switch continuation gap; it was fixed and verified in the browser. Final source and React checklist reviews found no remaining actionable defect.
- [Accepted design](../history/decisions/2026-11-17_conversation-booking-intake.md).

## Verification

- 60 focused API/database/route checks, 14 synthetic AI regressions, 15 web catalog tests, and 9 guidance tests pass. Workspace checks, production/Edge builds, Prisma validation, design ownership, and whitespace checks pass. Existing bundle-size advisory remains.
- Actual browser/API/disposable PostgreSQL verified package-less creation, same-thread readback, scratch private package/history, quotation blocking then exact-version delivery, catalog selection/assignment, and guest wrong-account recovery followed by claim/intake. Desktop and narrow layouts and keyboard dates were inspected.
- Local Edge health/OpenAPI expose optional package, conversation ID, and attachment route; unauthorized attachment returns 401. Authenticated feature proof uses Node; hosted Edge and live providers remain unverified.

## Remaining work

No implementation work remains for the approved slice. Task-only browser tabs, servers, database, accounts, sessions, and temporary fixture files were removed; the viewport was restored. Hosted deployment and live provider verification remain separate.

## Resume here

Review the combined diff and this evidence. Do not recreate fixtures or rerun checks without a changed artifact or unresolved concern. The migration is locally applied; deploy matching API/browser contracts together elsewhere.
