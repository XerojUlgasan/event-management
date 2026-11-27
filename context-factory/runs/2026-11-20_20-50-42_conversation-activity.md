# Conversation activity and availability

Started: 2026-11-20T20:50:42+08:00
Updated: 2026-11-20T20:50:42+08:00
Status: complete
Scope: User-authorized removal of conversation closure state and stored guest deadline; local migration and runtime verification, no hosted rollout or quotation send
Checkout: main at f853607a383804d1d8790023ff0cc8d7d36aba73; initially clean
Continues: [Quotation acceptance cleanup](2026-11-20_20-20-37_quotation-acceptance-cleanup.md)

## Goal

Make booking-linked and signed-in general conversations available regardless of prior closure; derive guest expiry from latest saved message or creation plus 24 hours.

## Result

Migration removes conversation status, closed timestamp, and guest deadline while preserving remaining state. The configured local database is migrated, Edge bundle/runtime refreshed, and the local background worker restarted. SCN-001 shows its existing draft and enabled Save and send in the browser. No quotation was sent in shared data.

## Changes or findings

- Central activity expressions and post-lock reads protect guest bootstrap, claim, send, AI, retries, queues, and media access. Reads/toggles do not extend expiry. Guest histories remain intact.
- API/OpenAPI and browser callers omit closure fields. Existing shared controls/styles are reused, with no shared component changes. Seed no longer invents closed conversations.
- Prisma create-only refused its noninteractive environment; used Prisma schema diff to generate SQL, reviewed ownership constraints/indexes, then deployed with Prisma. Types were generated from an isolated migrated database first.
- Requested routing: Terra medium for API and frontend, Sol high for independent review; actual execution models are unconfirmed. No model substitutions requested.

## Decisions

[Derive conversation availability](../history/decisions/2026-11-20_derive-conversation-availability.md).

## Verification

139 affected API/database/background tests and 57 frontend checks passed; 9 local Edge checks passed. API/web/UI types, lint, schema validation, web/Edge builds, guidance checks and nine guidance tests passed. Migration has no schema drift. Fingerprints across nine local application tables matched before/after excluding the three retired columns, retaining message/quotation/booking/AI state. Browser confirmed SCN-001's draft controls without sending; no provider call was required. Full workspace check stops at two unchanged catalog thumbnail import-boundary errors. Independent Sol review approved the final diff with no actionable findings; lock-test and rollout-documentation notes were resolved.

## Remaining work

No local implementation work remains. Hosted rollout remains separate; API, frontend, worker and migration must match.

## Resume here

Review this scoped diff. Preserve the local quotation as draft.
