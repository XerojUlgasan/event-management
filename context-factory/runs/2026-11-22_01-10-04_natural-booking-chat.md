# Natural booking conversations

Started: 2026-11-22T01:10:04+08:00
Updated: 2026-11-22T04:10:00+08:00
Status: complete
Scope: Casual language matching, one question per turn and natural approval of a corrected request.
Checkout: main at 67253d24, with existing booking and unrelated work in progress.
Continues: [Single-row booking drafts](2026-11-22_00-39-41_single-row-booking-drafts.md)

## Result

AMAC saves all details a customer volunteers and uses one missing field to guide its next question. The review takes its wording from recent customer messages and its facts from the saved booking. The signed-in customer can ask a question, correct a detail or approve sending the request in their own words. Submission checks the actual review, its saved details and the assessed reply. A retry keeps its original review and reuses a completed decision. [Booking specification](../../docs/specs/amac-conversational-booking.md)

## Verification

The configured model reproduced the original questionnaire behavior before the change. In the live Taglish regression, a phone number completed the draft, a date correction produced another review, and natural approval submitted the corrected request. Replaying the approval returned the same receipt with one status-history entry. The live English and Filipino cases also passed on rerun. An earlier English run produced no submission execution.

Chromium exercised a Spanish conversation through the customer composer. The July 16 correction survived a reload. The receipt reference matched the saved request, which had one status-history row. The loopback preview uses a freshly migrated disposable local database.

The focused API suites passed 119 tests, and the web message suites passed 22. Localization, web types, scoped lint and an isolated Edge build also passed. A final full API type check reported a `resourceId` narrowing error in the concurrently edited manual add-on conflict response. This chat change introduces no migration.

## Resume here

Run the opt-in conversation test from the workspace root with the local API database and configured Gateway available.

```sh
AMAC_LIVE_TOOL_TESTS=1 pnpm --filter @event-management/api exec tsx --test --test-name-pattern='live Gateway walks through' tests/ai/assistant-turn.test.ts
```
