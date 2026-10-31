# Clemora feature scope

Updated: 2026-10-30

## Current business workflow

Customers start with event type, preferred date, and estimated guest count. Package guest ranges are **estimates**, not booking-request limits: customers may request a different count for staff review. The current catalog editor publishes packages with a stated range within 30 to 100 guests. Staff define each package's inclusions individually; no services are inserted into every package automatically. Published packages have a fixed total price in Philippine pesos (PHP); all monetary amounts in the app use PHP. Staff review the final quote for the requested event. A reservation fee secures a date and is **credited toward the total package price** under the business's agreed terms.

This workflow is the product baseline. The earlier proposal explores a broader event and resource platform; its features are options to evaluate rather than fixed requirements.

## Booking journey

1. Customer views package details and submits a signed-in booking request with event type, preferred start and end time, estimated guests, contact details, preferred venue or location, and optional special requests.
2. The request shows its reference and review status. Counts outside the package's estimated range are flagged for staff review; the request does not reserve a date or establish a final price.
3. Customer chooses a package and requests optional add-ons. Staff check availability and send an itemized quote.
4. Customer accepts the quote and pays the reservation fee under the business's terms. Staff verify payment; the fee reduces the outstanding balance.
5. The booking becomes confirmed, and staff prepare from the approved event plan.
6. Changes to date, guests, package, or add-ons are recorded and reapproved when they affect price or delivery.

## Features for the first release

| Area | Needed behavior |
| --- | --- |
| Package catalog | Show guest range, price or price rule, included services, exclusions, and terms. Staff maintain package versions. Packages omit venue details from API and screens; the legacy database field remains for existing records. Booking requests retain a separate preferred venue or location. |
| Venue catalog | Maintain venues as a standalone versioned admin catalog with draft, publish, and archive; expose only published, nonarchived entries in the public catalog. Show featured venues on `/` after packages and services, with a detail preview and View more overlay for the full catalog. Fields: title, location, description, minimum and maximum capacity, optional editable categories, and up to 10 uploaded photos. Require positive minimum and maximum capacity to publish a new venue; photos are optional. Existing active venues migrate as visible published entries and archived venues remain hidden; migrated published entries may have null capacity or no photos. Google Maps pinning is deferred until an API key is available. Venue catalog entries do not establish availability or reservations. |
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

## Main agentic AI integration

The **Clemora Event Planning Assistant** carries a customer inquiry from the first message to a staff-ready booking request. It uses the system's approved package, pricing, add-on, availability, and booking records rather than inventing answers.

1. **Gather requirements:** Ask for event type, preferred date, estimated guests, and preferences. Ask follow-up questions when details are missing or unclear.
2. **Check live information:** Look up eligible packages, included amenities, optional add-ons, approved prices, and venue or add-on availability.
3. **Recommend an arrangement:** Suggest a suitable package and relevant add-ons, explain why they fit, and distinguish inclusions from extra charges.
4. **Prepare the request:** Save the conversation as a structured inquiry and draft an itemized quote for staff review.
5. **Guide the next step:** Explain the approved quote, reservation fee, and current booking status. Follow up when the customer needs to provide information or take action.
6. **Hand off to staff:** Escalate custom requests, uncertain answers, pricing exceptions, and booking decisions with a concise summary of the details collected.

The assistant may prepare and explain decisions, but authorized staff approve custom prices and booking commitments. Payment verification and date-conflict enforcement belong to the booking system; the assistant cannot mark a fee paid or promise an unconfirmed date.

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
