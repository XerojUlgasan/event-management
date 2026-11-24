# Booking package and quotation status eligibility

Date: 2026-11-19 (Asia/Manila)  
Status: implemented and locally verified; hosted rollout remains unverified  
Baseline: clean `main` at `e4ff29442ab7ca112ef0a203b87bf04a03f5416c` before the specification work; implementation remains uncommitted

This is a historical implementation record. The [Send and Cancel decision](../../context-factory/history/decisions/2026-11-21_direct-quotation-send.md) replaces the draft workflow below. The [booking request rules](../../context-factory/business/booking-requests.md#rules-and-boundaries) describe current status eligibility.

## Outcome and interpretation

System Administrators can prepare a quotation, create or edit a private custom package, and assign a catalog package while a booking request is **Under review**, **Needs details**, or **Accepted for processing**. Declined and cancelled requests retain readable records but cannot receive these changes. Acceptance is not a prerequisite for package or quotation preparation.

Interpretation of the user's “request quotation”: use the existing admin **Create draft** operation. Customers request quotations or changes through chat; this specification adds no request queue, customer action, or automatic draft creation. “Adding a package” means assigning one catalog package to a request without a current package. Replacing an existing choice or attaching multiple packages is outside this slice.

The requested status rule already existed in the API and booking package entry controls. The implementation aligns quotation controls with that rule, preserves eligibility in the three open statuses, and adds regressions for all five statuses.

## Required status matrix

These columns describe status eligibility. The prerequisites below still apply.

| Booking request status | Create/revise/save/send quotation | Create/edit custom package | Assign catalog package |
| ---------------------- | --------------------------------- | -------------------------- | ---------------------- |
| `under_review`         | Allowed                           | Allowed                    | Allowed                |
| `needs_details`        | Allowed                           | Allowed                    | Allowed                |
| `accepted`             | Allowed                           | Allowed                    | Allowed                |
| `declined`             | Blocked                           | Blocked                    | Blocked                |
| `cancelled`            | Blocked                           | Blocked                    | Blocked                |

Admin reads, package previews/history, and quotation history remain available on closed requests. Customers retain their existing ownership checks and sent-version visibility; they never gain quotation or package write permissions.

## Baseline before implementation

These findings describe the inspected baseline. The links identify the current source owners; the implementation below resolves the UI gaps.

- [Quotation context](../../apps/api/src/services/quotations/quotation-context.ts) defines a closed booking as `declined` or `cancelled`. The then-current create, revise, save, and send services all enforced that rule inside transactions. There is no accepted-only guard to remove.
- [Custom-package save](../../apps/api/src/services/booking-requests/save-custom-package.ts) rejects those two statuses before staging media and again after locking the booking. [Catalog assignment](../../apps/api/src/services/booking-requests/attach-booking-package.ts) rejects them inside the booking transaction. [Booking routes](../../apps/api/src/controllers/booking-requests/index.ts) and [quotation routes](../../apps/api/src/controllers/quotations/index.ts) require a session and System Administrator permissions for writes.
- [BookingRequestPage](../../apps/web/src/components/workspaces/admin/booking-requests/BookingRequestPage.tsx) passes `editable={!['declined', 'cancelled'].includes(item.status)}` to [BookingPackage](../../apps/web/src/components/booking-requests/BookingPackage.tsx). Its **Create custom package**, **Edit package**, and **Choose catalog package** entry actions already follow the requested status rule.
- The same page's `BookingQuotations` wrapper checked whether a proposal existed but passed no booking status or edit permission to [Quotations](../../apps/web/src/components/quotations/Quotations.tsx). That component rendered **Create draft**, draft adjustments, **Save adjustments**, **Save and send**, and revision actions using admin/draft/offer state. A closed booking with a package could therefore display write actions that failed with `409` at the API.
- [MessagesWorkspace](../../apps/web/src/components/messages/MessagesWorkspace.tsx) also mounts `Quotations` for message-linked versions. [ConversationContext](../../apps/web/src/components/messages/ConversationContext.tsx) uses `QuotationSummaryRead` for the latest sent offer. Preserve these read paths and audit every shared quotation caller when adding edit eligibility.
- [Quotation integration tests](../../apps/api/tests/quotations.test.ts) already covered draft creation under review, accepted-request quotation delivery, missing proposals, private packages, concurrent package assignment/custom creation, stale writes, and closed-conversation delivery. They lacked a complete five-status write matrix. The existing [web quotation tests](../../apps/web/tests/quotations/latest-sent-quotation.test.ts) covered latest-sent lookup rather than control eligibility.

These are source and test-content findings, not current browser or database execution results. The [quotation](../../context-factory/business/quotations.md), [booking](../../context-factory/business/booking-requests.md), and [catalog](../../context-factory/business/catalog.md) business references support the existing responsibilities and prerequisites.

## Required behavior

### 1. Apply eligibility to every quotation write control

Pass the loaded booking's status eligibility through `BookingQuotations` to `Quotations`, separately from the existing admin role flag. Use the same two excluded statuses as the package controls. Apply it to creation, adjustment fields and add/remove actions, saving, sending, and both draft and sent-offer revision controls. Do not hide the entire quotation panel: admin drafts and financial history must remain readable.

For declined or cancelled requests, show a short explanation such as “This request is declined. Packages and quotations are read-only.” Use the actual status. Show **No quotation yet** without a creation prompt where no quotation exists. For open requests without a proposal, retain **Prepare or choose a package before creating a quotation**. On closed requests without a proposal, explain the read-only state without instructing the admin to prepare one.

Every admin caller that exposes quotation writes must supply eligibility from its owning booking, or load it through the existing admin booking read operation. Until that state is known or when loading fails, keep writes unavailable and retain the existing read/error/retry experience. Do not infer eligibility from quotation status, conversation status, `admin`, or package presence. Existing read-only summary views need no new write capability.

Use the existing refresh and status-update lifecycle to recalculate eligibility. If a locally observed status change closes the request, stop an open quotation editor/revision form or make it read-only immediately. Recheck eligibility in mutation handlers as well as rendering. No new polling service or API capability endpoint is required.

### 2. Preserve package behavior and close stale forms

Keep the existing open-status entry controls:

- No proposal: **Create custom package** and **Choose catalog package**, followed by **Assign package**.
- Catalog proposal: **Edit package** creates a booking-owned private copy.
- Custom proposal: **Edit package** updates that private package.

Apply `editable` to already-open catalog selectors and custom editors as well as entry buttons. If a refreshed booking becomes declined/cancelled, an old form must not remain able to submit. Preserve previews and history. Keep all three open statuses equally eligible.

### 3. Retain prerequisites and server authority

- Quotation creation requires a prepared catalog/private proposal with a supported positive base price, a current booking revision, and no active quotation. Continue an existing draft or explicitly revise an active offer instead of creating a duplicate. An unchanged package-only draft with no adjustments remains valid.
- Private packages remain booking-owned and excluded from public selection. One private proposal per booking, source availability, booking/package revisions, media isolation, and audit attribution stay enforced.
- Catalog assignment requires no existing catalog choice or private proposal, an available catalog package, and the current booking revision. It does not overwrite an existing proposal.
- Saving/revising/sending retains the current draft/version checks, arithmetic, review requirements, and audit trail. Sending additionally requires the linked booking conversation and a nonnegative total. Conversation age and prior closure do not block delivery; conversations have no stored closed state.
- Preserve booking row locks, expected revisions, and the custom-package status recheck after media staging. If another session closes a request before a write obtains its booking lock, reject the write with the existing conflict behavior and commit no proposal, quotation, delivery message, or success audit for that rejected operation. A write that commits before closure is valid history.
- On a conflict, show the error and require refreshing the booking before retrying; do not automatically replay the mutation or report success. After refresh, render the current eligibility. Preserve staged-media cleanup behavior on custom-package failure.

The API already supplies the status, transaction, and prerequisite guards described above. Change a server guard only if a regression exposes a mismatch; do not relax it to make a visible button succeed. No schema migration, new role, route, quotation lifecycle, booking confirmation, reservation, payment, inventory, or supplier feature is required.

## Implementation surface and reuse

The expected change is in `BookingRequestPage`, `Quotations`, and the existing `BookingPackage` form guards, plus focused tests. Audit the message-linked `Quotations` caller for status context without changing version links or customer visibility. Keep existing HTTP payloads and [client booking-package](../../apps/web/src/lib/data/booking-requests/packages.ts) and [quotation operations](../../apps/web/src/lib/data/quotations/quotations.ts).

Reuse the current app components, `PackageEditor`, `QuotationSummaryRead`, and shared `Button`, form controls, dialogs, notifications, and history pagination. Business eligibility belongs in the app layer; no new shared visual component or theme token is proposed. Future UI implementation must complete the frontend/packages reuse audit and rendered verification required by repository guidance.

## Acceptance and verification

1. For **each of the five statuses**, directly test quotation create, revise, save, send; custom create from scratch, create from a catalog copy, update; and catalog assignment. Use valid independent fixtures so active-quotation, existing-package, stale-revision, or closed-conversation errors cannot mask the status rule. The first three statuses succeed when prerequisites are met. Declined/cancelled return `409` without committed mutation effects. Check status eligibility separately from authentication/authorization failures.
2. In the admin booking UI, verify all five statuses with no proposal, a catalog proposal, and a private proposal. Open requests expose the appropriate package actions; quotation creation becomes available only after a proposal exists. No action requires changing the request to accepted first.
3. Cover empty quotation state, an existing draft, a sent offer, and superseded history. Closed requests show no usable create/edit/save/send/revise controls; admin draft and history reads remain available. Open-state revision behavior and exact-version links are preserved.
4. Change status while an editor/selector is open, then refresh. Controls become read-only. Separately close the booking from another session before submission: the API rejects the stale/closed write, no success state appears, and refresh removes write access. Verify the closure-versus-write ordering with the shared booking lock and assert rejected writes have no durable side effects.
5. On an open request with an old linked conversation, draft/package preparation and delivery work. Test missing proposal, duplicate active quotation, existing-package assignment, unavailable catalog source, and stale booking/package/quotation revisions independently. Retain private-media isolation and historical amounts.
6. Verify customer and other-customer boundaries, admin message-linked quotation views, latest-sent lookup, keyboard use, and narrow layouts. Customers never see drafts or admin write actions.

During implementation, extend the existing quotation/booking integration suites and add focused UI behavior coverage; a predicate-only test cannot establish that every control uses it. Inspect disposable-database setup before running `pnpm --filter @event-management/api test:quotations` and `pnpm --filter @event-management/api test:booking-requests`. Run the affected API/web type checks, `pnpm check:design`, and rendered admin flows. Exercise Node/Edge route authorization if registration or contracts change. Do not treat type checks as browser or database proof.

## Investigation verification and remaining scope

Two read-only Terra investigations traced API and UI paths independently; the lead inspected their consequential source findings and test coverage. No application tests, database operations, browser journeys, services, or provider calls were run for this documentation-only task. Documentation checks and the final review are recorded in the [investigation run](../../context-factory/runs/2026-11-19_22-20-00_booking-proposal-status-spec.md).

The investigation established the stated interpretation. A separate quotation-request workflow, replacing a selected package, or supporting multiple attached packages requires a further business decision.

## Implementation and local verification

The [implementation run](../../context-factory/runs/2026-11-19_22-43-07_booking-proposal-status-implementation.md) records the final artifact, independent review, checks, and environment cleanup.

- `BookingRequestPage` passes status, proposal availability, and booking refresh through the quotation wrapper. `Quotations` gates every write independently of role, loads status for other admin callers, retains draft/history reads, and requires explicit booking refresh after conflicts. Captured mount, scope, and eligibility generations stop pending preflights or saves from starting a subsequent write after the view changes.
- `BookingPackage` guards active selectors/editors and their submission handlers with eligibility; refreshed closure removes those forms. Package conflicts also require booking refresh before retry.
- The API's existing guards and HTTP contracts remain unchanged. The expanded quotation suite passes all 18 tests, including five statuses across eight operations, both booking-lock orderings, closed-conversation preparation versus delivery, and independent prerequisite conflicts with persisted-state assertions. The booking suite passes all 11 tests.
- The new [ReactDOM behavior suite](../../apps/web/tests/quotations/proposal-status.test.mjs) passes all 22 tests, including all status controls, conflict recovery, pending-action scope/closure cases, historical offers, and customer exact-version reads. Run it with `pnpm --filter @event-management/web test:proposal-status`. `happy-dom` is a web development dependency only. The seven existing latest-sent tests also pass.
- The 2026-11-19 isolated Node API run with disposable migrated PostgreSQL and the actual web app verified all five statuses with missing/catalog/private proposals; under-review assignment, draft creation and sending with API readback; legacy accepted-offer revision and superseded history under the then-current model; stale-save conflict/refresh; selector closure; admin and customer message-linked views; and narrow/keyboard navigation. Current quotation statuses are `draft`, `sent`, and `superseded`. These checks used synthetic accounts and media-free fixtures, with AI disabled.
- API/web type checks, scoped ESLint/Prettier, whitespace, and guidance checks pass. Web structure still reports two existing `use-thumbnail.ts` boundary errors; design checks still report five existing thumbnail/CSS issues. Both sets were reproduced from unchanged `HEAD` in a scratch baseline. They are outside this feature's diff.

For the booking-status eligibility implementation recorded here, no schema change, configured application database migration, live provider call, or hosted deployment was required or performed. Local proof does not establish hosted behavior.
