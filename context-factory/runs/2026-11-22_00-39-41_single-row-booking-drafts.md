# Single-row conversational booking

Started: 2026-11-22T00:33:00+08:00
Updated: 2026-11-22T00:53:07+08:00
Status: complete
Scope: Replace the earlier draft schema with a single booking request per conversation, implement two AMAC tools and document booking contents.
Checkout: main at 67253d2 with unrelated business-information, notification, quotation and UI work.
Continues: [Original conversational booking implementation](2026-11-21_23-50-39_conversational-booking.md)

## Result

The same booking row collects fields, survives guest claim and enters review after confirmation. The composer pins the displayed assistant reply. The server can compare that reply, the current booking revision and catalog facts before submitting. Ordinary messages carry the readable summary and receipt. [Specification](../../docs/specs/amac-conversational-booking.md) · [Decision](../history/decisions/2026-11-22_single-row-booking-drafts.md)

## Verification

The configured local database already had the earlier migration. A forward migration was applied to disposable databases for upgrade tests and Kysely generation. The application's shared database was only inspected for migration presence. The upgrade test covered existing submitted requests, active guest and signed-in drafts, historical review messages and old long notes.

The combined API, migration, Edge route, messaging, booking, quotation and scheduling suites passed 211 tests, with five opt-in Gateway cases skipped in that command. Separate configured-model runs exercised English and Filipino submission and the package discovery, budget, service selection and confirmation flow. Twenty-two focused web message tests passed. API and Astro type checks, Prisma validation, scoped lint and formatting, the isolated Edge bundle and guidance checks passed.

A Chromium journey on disposable services exercised guest drafting, sign-in, claim, ordinary review and submission with a live model. Later tests cover retries after an unavailable provider, stale summaries and late replies. Astro checked the submission date display change. The browser run preceded the final retry and date display changes.

## Remaining work

Hosted rollout is pending. The repository web structure check reports two existing import violations in `apps/web/src/lib/utils/catalog/use-thumbnail.ts`.

## Resume here

Use the [forward migration](../../apps/api/prisma/migrations/20261122010000_booking_request_drafts/migration.sql) with matching API, message-worker and web builds for release. Verify the served application on the intended target before claiming rollout.
