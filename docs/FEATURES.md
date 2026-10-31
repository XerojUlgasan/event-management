# Clemora feature scope

Updated: 2026-11-01

## Current business workflow

Customers start with event type, preferred date, estimated guest count, estimated event length, and a phone number for follow-up. Event length can be about 4, 8, or 12 hours, one or two event days, or undecided; the preferred date is the first day. These are estimates, not booked hours. Package guest ranges are **estimates**, not booking-request limits: customers may request a different count for staff review. The current catalog editor publishes packages with a stated range within 30 to 100 guests. Staff define each package's inclusions individually; no services are inserted into every package automatically. Published packages have a fixed total price in Philippine pesos (PHP); all monetary amounts in the app use PHP. Staff review the final quote for the requested event. A reservation fee secures a date and is **credited toward the total package price** under the business's agreed terms.

This workflow is the product baseline. The earlier proposal explores a broader event and resource platform; its features are options to evaluate rather than fixed requirements.

## Booking journey

1. Customer views package details and submits a signed-in booking request with event type, preferred date, estimated guests, estimated event length, and contact name and phone. The selected package and signed-in account are implicit. A type missing from the list can be described in a conditional text field; additional notes are optional.
2. The request shows its reference and review status. Counts outside the package's estimated range are flagged for staff review; the request does not reserve a date or establish a final price.
3. Staff follow up for exact start and end times, venue or location, services, and other details needed to check availability and prepare an itemized quote. One or two event days do not imply 24-hour or overnight use. The existing request status and general messages support follow-up; structured updates to these deferred details are later workflow work.
4. Customer accepts the quote and pays the reservation fee under the business's terms. Staff verify payment; the fee reduces the outstanding balance.
5. The booking becomes confirmed, and staff prepare from the approved event plan.
6. Changes to date, guests, package, or add-ons are recorded and reapproved when they affect price or delivery.

## Features for the first release

| Area | Needed behavior |
| --- | --- |
| Package catalog | Show guest range, price or price rule, included services, exclusions, and terms. Staff maintain package versions. Packages omit venue details from API and screens; the legacy database field remains for existing records. Booking requests retain a separate preferred venue or location. |
| Venue catalog | Maintain venues as a standalone versioned admin catalog with draft, publish, and archive; expose only published, nonarchived entries in the public catalog. Show featured venues on `/` after packages and services, with a detail preview and View more overlay for the full catalog. Fields: title, location, description, minimum and maximum capacity, optional editable categories, and up to 10 external HTTPS photo URLs. Require positive minimum and maximum capacity to publish a new venue; photos are optional. Existing active venues migrate as visible published entries and archived venues remain hidden; migrated published entries may have null capacity or no photos. Google Maps pinning is deferred until an API key is available. Venue catalog entries do not establish availability or reservations. |
| Amenities and add-ons | Separate included amenities from optional paid add-ons. Examples to validate with the business include a photo booth, upgraded decorations, a projector, and extra venue hours. Store each add-on's price, quantity or duration, availability, and setup needs. |
| Inquiry | Collect the minimum event requirements and give the customer a reference and status. Allow free-text requests for staff review. |
| Availability | Calendar for available, temporarily held, and confirmed venue periods. Account for exclusive use and setup/cleanup buffers. Check limited add-ons or external providers where relevant. |
| Quotation | Itemize package and add-ons, calculate total and fee/balance, record validity and terms, and retain sent and revised versions. Staff approve nonstandard requests. |
| Reservation and payment | Track fee due, payment reference or proof, staff verification, payment history, remaining balance, and due date. Credit the fee exactly once. A payment gateway is optional initially. |
| Booking management | Track inquiry, quoted, awaiting fee, confirmed, preparing, completed, and cancelled states. Record rescheduling, cancellations, approvals, and important changes. |
| Event plan | One approved record for date and times, guests, menu, venue layout, catering, sound and lights, add-ons, contacts, and special instructions. |
| Preparation | Assign and track checklists for catering, venue setup, sound and lights, and add-on fulfillment. Notify affected staff of approved changes. |
| Communication | Send and retain quote, fee, confirmation, change, and balance notices. Keep customer-to-staff messages tied to the event. |
| Access | Customer view of their inquiry/booking and authorized staff views for catalog, quotes, payments, calendar, and preparation. Enforce permissions on the server. |

## Deferred assistant integration

AI-assisted event planning is deferred. Customer messages go to the Clemora team, and authorized staff handle replies and booking decisions. The current release does not expose AI replies, handoff, or takeover controls. Any future assistant must use approved catalog and booking records, and staff must retain authority over prices, commitments, and payment verification.

## Next features

- **Simple reports:** inquiries, quote conversion, upcoming and completed events, outstanding balances, and package/add-on demand, calculated from real records.
- **Past events and feedback:** publish selected event examples and collect customer feedback after completion.

## Decisions to confirm with the business

- Is the venue exclusive for a whole date, or can different events use different time slots? What setup and cleanup time is required?
- What are the exact package tiers, guest ranges, and fixed PHP prices for 30 to 100 guests?
- Which amenities are included in each package, and which add-ons can actually be sold? Can an add-on be booked for more than one event at a time?
- How much is the reservation fee, when is it due, and does a date have a temporary hold before payment?
- What are the rules for fee refunds, cancellation, rescheduling, balance payment, and guest-count changes?
- Does a booking require staff approval after payment verification?

Until these are confirmed, use configurable terms and staff review rather than imply a fixed policy.
