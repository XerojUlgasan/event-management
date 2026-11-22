# Booking-owned add-ons

Started: 2026-11-22T05:12:21+08:00
Updated: 2026-11-22T05:34:00+08:00
Status: complete
Scope: Implement booking-owned add-ons, migrate historical data, update AMAC and verify the flow locally.
Checkout: main at 4354f6cc with the implementation in the working tree.
Continues: [Manual booking add-ons](2026-11-22_01-16-37_manual-booking-add-ons.md)

## Result

Booking requests own the editable add-on list. Manual fixed and hourly selections appear in preparation automatically. Admin booking controls use revision-checked writes. Packages supply base price and included service widgets. AMAC reads package inclusions from the proposal and booking add-ons through the request-history tool. New sent versions preserve total booked hours and billed hours alongside the terms. The [ownership decision](../history/decisions/2026-11-22_booking-owned-add-ons.md) records the approved change.

## Verification

- Disposable PostgreSQL migration tests replayed a fresh schema and upgraded populated legacy requests, including duplicate-source rollback, prior omissions, archived services, chat drafts and immutable quotation, message, and audit snapshots. Prisma reported all 86 migrations applied.
- The integrated API run passed 159 tests with six opt-in live Gateway cases skipped. Catalog and quotation web suites passed 58 tests. API and web type checks and the web and Edge builds passed.
- Against the built web app and Node API, Chromium submitted both pricing models on mobile, edited hours on desktop, reloaded the booking, sent a quotation, and found the exact-version card as the customer. A separate Supabase Edge runtime passed 12 route checks and an authenticated booking, edit, delivery, and concurrent retry.
- Changed-file lint and guidance checks passed. Workspace-wide lint and web-structure checks still report existing padding and import-boundary issues in untouched files.
- The work used disposable local services. Hosted rollout and live model behavior remain unverified.

## Resume here

Review the working-tree diff. Deploy both new migrations with compatible API, web, and worker builds during the same rollout. The relevant suites are `test:booking-requests`, `test:quotations`, `test:conversational-booking`, `test:catalog`, and `test:proposal-status`.
