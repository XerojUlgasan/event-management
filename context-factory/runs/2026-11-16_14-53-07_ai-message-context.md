# AI message date and booking context

Started: 2026-11-16T14:46:00+08:00
Updated: 2026-11-16T14:53:07+08:00
Status: complete
Scope: User authorized adding date/time and the selected conversation's nullable booking request to every customer AI turn; exclude package fields and unnecessary contact details
Checkout: feat/ai at 61ef291; initially clean; scoped changes remain uncommitted
Continues: [Automatic text replies](2026-11-16_14-21-59_automatic-text-replies.md), [Booking package details](2026-11-16_14-41-10_booking-package-details.md)

## Goal

Supply the agreed context alongside saved message history and identify the payload builder for the user.

## Result

`services/ai/assistant-context.ts` reads the linked request through the existing customer-scoped service. Each turn prepends its serialized JSON as a data message before history. General conversations have a null request; an inaccessible linked request prevents generation. Context is not persisted as a chat message.

## Changes or findings

- Added current UTC ISO timestamp and explicit booking timezone, defaulting to `Asia/Manila` for general conversations.
- Projected reference, status, event type, guest count, requested days, operational schedules, location preference, and special requests. Package/contact fields and internal IDs are excluded, including nested schedule IDs.
- Preserved legacy preferred date and start/end times only when the complete requested-day list is absent.
- Updated the static prompt, counted serialized context toward the existing 200,000-character input budget, and synchronized current README/AI implementation guidance.

## Decisions

No tools, quotation data, catalog context, new actions, UI changes, or live provider calls. Existing history, failure handling, and reply persistence remain in the Messages flow.

## Verification

All 10 AI integration tests passed against a disposable migrated local PostgreSQL database with an SDK mock provider. Coverage includes fresh context, null/general and linked requests, legacy dates, exact projection, ownership, no context persistence, history ordering, failures, cancellation, and the combined budget. API types, Edge bundle build, guidance checks and 9 checker tests passed. Independent Sol source review found no actionable defects. Changed code passes formatting; README retains its pre-existing catalog-table alignment warning. Browser, running Edge generation, production, and live-provider behavior were not exercised.

## Remaining work

No requested implementation remains. Deployment, commits, and live model evaluation remain separate.

## Resume here

Inspect the context builder and `run-assistant-turn.ts` before extending fields or actions. Preserve the customer filter and explicit nested projections.
