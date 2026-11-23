# AMAC conversational booking requests

Started: 2026-11-21T23:50:39+08:00
Updated: 2026-11-21T23:56:34+08:00
Status: complete
Scope: Implement and verify the approved conversational booking specification locally.
Checkout: main at 67253d2 with existing business-information, quotation, notification and label changes.
Continues: [Conversation-based booking intake](2026-11-17_00-55-00_conversation-booking-intake.md)

## Goal

Let a customer describe an event, choose a public package, request extras, correct details and submit the reviewed inquiry inside the original conversation.

## Result

Each eligible draft mutation persists in PostgreSQL. Completed drafts generate a structured review. The customer’s signed-in reply to that exact review creates one request under review and returns a receipt. Guest sign-in preserves the conversation. Customer and admin booking details display confirmed preferences and requested services.

## Decisions

The [decision](../history/decisions/2026-11-21_conversational-booking-drafts.md) defines ownership, review and submission. The [specification](../../docs/specs/amac-conversational-booking.md) records the tool contracts, rollout dependencies and acceptance cases.

## Verification

The combined API suite passed 154 cases with five opt-in live-model cases skipped. It covered catalog changes, guest claim, takeover, concurrent submissions, the existing form, injected failures and receipt replay. The quotation suite passed 22 cases. Four focused web tests passed, including confirmation typed before a newer review arrives. API and Astro type checks, Prisma validation, the isolated Edge build and repository guidance checks passed.

Chromium exercised guest authentication and claim, customer and admin readback, and a real configured-model recommendation through review and submission. That browser run found a missing discovery budget and ambiguous capacity wording. After correction, live API tests verified that the earlier package budget, selected package and custom service reached the submitted request. English and Filipino capture and corrections were also evaluated. The browser used HTTP and refresh. The Realtime delivery contract and stale-composer fix were checked in focused tests.

## Remaining work

Rollout requires the target migration and matching builds. The repository web structure check still reports two existing import violations in `apps/web/src/lib/utils/catalog/use-thumbnail.ts`. Recommendation quality depends on the configured model and catalog. An early evaluation misapplied an unscoped budget as a package-price ceiling. A later evaluation preserved the budget and omitted that filter.

## Resume here

For rollout, apply migration `20261121160000_conversational_booking` before releasing the matching API, message worker and web application. Verify a new inquiry in the intended environment. Shared and hosted environments were outside this local implementation.
