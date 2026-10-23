# Clemora product roadmap

Updated: 2026-10-23

## Product direction

Build for the current business workflow: a customer chooses an event type, preferred date, and estimated guest count; reviews an all-inclusive package for 30 to 100 guests; may request amenities or paid add-ons; receives a quote; and secures the date with a reservation fee credited to the total price. The package includes exclusive venue use, buffet and venue setup, full catering, and sound and lights.

[FEATURES.md](FEATURES.md) is the current feature and rule reference. [proposal-reference.docx](proposal-reference.docx) is an earlier, broader proposal and may change as business rules are confirmed.

The public root route now has an informational landing page with an interactive 3D event scene. The earlier visual prototype with sample data remains in source but is not mounted. The API has a health route and the database has no event domain models. Landing copy is not evidence that an inquiry or booking workflow is implemented.

## Phase 0 — Confirm business rules

- [ ] Confirm whether exclusive venue use means one event per day or bookable time slots, including setup and cleanup buffers.
- [ ] Record package guest ranges, price rules, included amenities, add-ons, and any add-on capacity or scheduling limits.
- [ ] Set the reservation fee amount or calculation, payment deadline, acceptable payment methods, cancellation and refund rules, and balance due date.
- [ ] Confirm quote expiry, change approvals, and guest-count changes after confirmation.
- [ ] Walk through one real inquiry, quote, add-on selection, fee payment, confirmed event, and post-confirmation change.

**Done when:** staff agree on booking states and the exact point at which a date becomes secured.

## Phase 1 — Inquiry, packages, add-ons, and quotes

- [ ] Add real staff access and server-side permissions.
- [ ] Manage packages, included amenities, paid add-ons, prices, and availability rules.
- [ ] Publish package details and an inquiry form for event type, preferred date, estimated guests, contact details, and special requests.
- [ ] Show date availability and prevent conflicting confirmed reservations for exclusive venue use.
- [ ] Let staff review inquiries and produce versioned quotes showing package, add-ons, total price, reservation fee, and balance.
- [ ] Give customers a reference and visible inquiry or quote status.

**Done when:** a 30-to-100-guest inquiry can become an accurate quote and a photo booth or similar add-on appears in both the price and availability check.

## Phase 2 — Reservation fee and booking confirmation

- [ ] Track quotes awaiting a fee separately from confirmed bookings; define any temporary date-hold expiry.
- [ ] Record fee payment, reference or proof, verification, and receipt. Start with staff-recorded payments unless a payment gateway is required.
- [ ] Credit the verified fee against the package-plus-add-ons total exactly once; show remaining balance and due date.
- [ ] Confirm only after the agreed fee and staff verification rules are satisfied.
- [ ] Support cancellation, rescheduling, and quote revisions with visible history and any required customer approval.
- [ ] Notify customer and relevant staff when quote, payment, or booking state changes.

**Done when:** a date cannot be confirmed twice and customer and staff see the same approved package, add-ons, payment, and balance.

## Phase 3 — Event preparation and delivery

- [ ] Turn the confirmed booking into one event plan: date and times, guest count, menu, layout, included services, add-ons, contacts, and special instructions.
- [ ] Assign preparation checklists for catering, venue setup, sound and lights, and each selected add-on.
- [ ] Track add-on fulfillment, including external provider details where applicable.
- [ ] Show approved changes to affected staff and retain previous approved details.
- [ ] Record completion, final guest count, approved extras, payments, and customer feedback as needed for closeout.

**Done when:** staff can prepare and deliver an event from the current approved plan without reconciling conflicting screens.

## Phase 4 — Customer assistance and reporting

- [ ] Add an AI assistant grounded in approved packages, add-ons, prices, policies, and current availability. It may answer questions, collect requirements, and suggest options; staff approve quotes and booking commitments.
- [ ] Hand off when the assistant lacks a reliable answer or the customer requests staff help.
- [ ] Report on inquiries, quotes, bookings, events, outstanding balances, and package or add-on demand using recorded data.
- [ ] Add a past-events gallery and feedback display if they help customers choose a package.

**Done when:** recommendations can be checked against source records and reports match bookings and payments.

## Later only if operations require it

Detailed equipment inventory, staff skills and shift optimization, supplier management, incident tracking, advanced analytics, and payment-gateway integration. Ticketing, attendee registration, and speaker programs are outside the present package-and-venue workflow.

## Verification throughout

- Enforce dates, guest limits, money calculations, booking state changes, access rules, and venue/add-on conflicts in the API and database, including competing booking attempts.
- Check a full example: 80 guests, package plus photo booth, quote revision, fee credited to the total, confirmation, approved change, preparation, and final balance.
- Keep the business time zone, currency, and terms consistent in the UI, API, messages, and documents.
- Replace prototype sample data before presenting any feature as live.
