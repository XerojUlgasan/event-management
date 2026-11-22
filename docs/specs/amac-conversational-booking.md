# AMAC AI conversational booking requests

A customer can describe an event over several messages, choose a public package, ask for extras and submit an inquiry from that same chat. AMAC saves the first booking detail on a booking request with an empty `submitted_at`. Each correction updates that row. Only submission makes the request visible in My events, the admin booking list and the bookings calendar.

## What a booking contains

| Detail | Needed to submit | What AMAC records |
| --- | --- | --- |
| Event type | Yes | The customer's description, such as a wedding reception, birthday or conference. |
| Duration and requested dates | Yes | One day and one date, or multiple days and at least two distinct dates. Dates can be nonconsecutive. Ask whether “Saturday or Sunday” means alternative dates. Clarify the year when ambiguous. |
| Event timezone | Yes | The timezone used to interpret local dates and determine whether a date is in the past. State the zone in the summary. |
| Contact person and phone number | Yes | The person coordinating the event and their supplied number. Keep leading zeroes and country prefixes. |
| Guest count and venue | Optional | Estimated attendance and preferred physical location, including “venue undecided.” Attendance helps AMAC compare package capacities. |
| Selected package | Optional | One customer-chosen public package. A customer can request a custom arrangement or proceed without a package. Show the current package name, listed PHP price, capacity and any capacity warning. |
| Requested services | Optional | A public service or a custom request, with hours and notes when supplied. Distinguish inclusions from requests for extra coverage. The admin decides billable add-ons when preparing the private package. |
| Budget | Optional | Amount, currency and scope as the customer describes them. Ask whether a budget covers the package or the whole event before using it as a package-price ceiling. |
| Special requests | Optional | Theme, accessibility, setup, timing preferences or other logistics. “Six hours” is useful here even before the customer knows the exact times. |

Only customer-provided or confirmed facts belong on the draft. Existing details survive an unrelated edit. Use the customer’s language, including their natural mix of languages. Keep the tone relaxed and carry the conversation’s language through short replies such as a phone number. Save all volunteered facts in one update and ask at most one follow-up about the next missing or unclear detail. An ordinary catalog question can receive an answer without creating a booking. Booking dates express preferences, and submission sends the request to AMAC for feasibility and pricing review. [Booking validation](../../apps/api/src/controllers/booking-requests/schemas.ts) · [Booking responsibilities](../../context-factory/business/booking-requests.md)

## Tools and customer flow

1. **Collect and correct.** `updateBookingDraft` uses the current conversation and a partial patch. It creates or updates the associated booking row and checks what is still needed. An active guest can collect details now and claim the same chat and draft after signing in.
2. **Recommend and select.** Use the existing `searchPublicCatalog` and `getPublicCatalogItem` tools for current listings, capacity, prices and inclusions. Explain the fit using the customer's event needs. An explicit selection or delegated choice can be added to the draft. Resolve “the second one” against the shortlist shown in this conversation. Preserve requests for unlisted services in the customer's words.
3. **Review.** Once complete, show the saved details as an ordinary chat message, including supplied optional fields and warnings. If the customer asks to add a service without choosing one, ask which service they want before showing the review again. Save their choice under **Requested services** in the updated review. Show the review in the customer’s language and finish with one clear question about sending the request to AMAC. A correction or a material catalog change requires a fresh summary. A signed-in customer who started as a guest reviews the details after claim.
4. **Submit.** The server asks the model to interpret the signed-in customer’s reply to the displayed summary. A clear approval triggers `submitBookingRequest` using the saved draft. After “I-send ko na sa AMAC team?”, “Sige, go na” authorizes submission. “Sige, pero palitan muna yung date” asks for a correction. The server derives the customer, conversation and triggering message, checks consent, verifies the reviewed revision and catalog, and validates the saved fields against current rules. Questions and ambiguous replies leave the request in draft. After a correction, the customer reviews and approves the updated details.
5. **Receive the reference.** A successful submission sets `submitted_at` on the existing row, records the initial **Under review** history, notifies admins and delivers the receipt in the original chat. The receipt tells the customer to message the AMAC team there for package or add-on changes. The customer can see the request in My events. Retries and competing form submissions must produce only one submitted request.
6. **Send changes to staff.** Submission ends AI edits to the draft. If a customer asks to change the submitted request, AMAC AI uses the human handoff in the same chat. Staff see the requested change and handle any booking or quotation updates. Customers can still ask informational questions before a handoff.

## Storage and rollout

The existing unique `conversations.booking_request_id` link identifies the draft from the first write. The contact and scheduling fields may be empty while collecting. An anonymous draft has no customer ID until claim. The server reads the same ordinary booking columns for validation and submission. `duration_mode` can be recorded even before dates are known. `requested_services` holds each requested service, `budget` holds the customer's budget wording and `special_requests` holds other preferences.

The forward migration backfills existing submitted requests using their original creation time, moves active conversational drafts to booking rows and converts historical review cards into readable message text. Old review messages remain readable. Generate a fresh summary to submit an imported draft. Deploy the migration with the matching API, message worker and web client. [Migration](../../apps/api/prisma/migrations/20261122010000_booking_request_drafts/migration.sql) · [Booking schema](../../apps/api/prisma/schema.prisma)

## Verification

Test partial updates, explicit selection, guest claim, truthful summaries, stale consent, archive or price changes, and a caller attempting to submit incomplete data. Verify in PostgreSQL that acquisition, correction and submission retain one booking ID, failed submission leaves it unsubmitted, and retries create a single history entry and receipt. Exercise normal form submission, customer/admin reads, calendar counts and message rendering. Use a configured-model conversation to confirm a corrected draft in everyday language, check the receipt guidance, and request a package or add-on change. Verify that the same conversation shows a pending staff handoff and the submitted selections retain their saved values. [Run record](../../context-factory/runs/2026-11-22_00-39-41_single-row-booking-drafts.md)
