# Clemora feature scope

Updated: 2026-11-02

## Current business workflow

Customers start with event type, preferred date, estimated event length, contact person, and phone number for follow-up. Event length can be one through six days, one week, more than one week with an exact day count, or unspecified; the preferred date is the first day. These are estimates, not booked hours. Guest count is gathered later during staff follow-up. A package’s maximum guest count remains a catalog estimate. The catalog accepts any positive maximum guest count. Administrators describe each package's inclusions in its own content; there are no package-to-service assignments. Published packages have a fixed total price in Philippine pesos (PHP); all monetary amounts in the app use PHP. Staff review the final quote for the requested event. A reservation fee secures a date and is **credited toward the total package price** under the business's agreed terms.

This workflow is the product baseline. The earlier proposal explores a broader event and resource platform; its features are options to evaluate rather than fixed requirements.

## Booking journey

1. Customer views package details and submits a signed-in booking request with event type, preferred date, estimated event length, and contact name and phone. The selected package and signed-in account are implicit. The event-type choices are Birthday, Wedding, and Corporate. “Not on the list” opens a required custom event-type field; additional notes are optional.
2. The request shows its reference and review status. At submission, it snapshots the package name, price, and maximum guest count; later catalog edits do not change that request. The request does not reserve a date or establish a final price. Historical requests retain any guest counts previously collected.
3. Staff follow up for exact start and end times, guest count, venue or location, services, and other details needed to check availability and prepare an itemized quote. A selected event length does not imply 24-hour or overnight use. The existing request status and general messages support follow-up; structured updates to these deferred details are later workflow work.
4. Customer accepts the quote and pays the reservation fee under the business's terms. Staff verify payment; the fee reduces the outstanding balance.
5. The booking becomes confirmed, and staff prepare from the approved event plan.
6. Changes to date, guests, package, or add-ons are recorded and reapproved when they affect price or delivery.

## Features for the first release

| Area | Needed behavior |
| --- | --- |
| Package catalog | Show an editable catalog description on package cards, maximum guest count, fixed price, and package content built from photo, Markdown, and video widgets. System Administrators create complete packages that publish on save, edit the current package directly, and archive it when it should no longer be offered. Packages have no draft or version lifecycle and no structured service assignments. Booking requests snapshot package name, price, and guest maximum. Package terms and venue details are not stored; the package-canvas migration removes existing package records, booking requests and status history, and booking-linked conversations/messages while preserving general conversations/messages. Booking requests retain a separate preferred venue or location. |
| Service catalog | Maintain standalone flat service records with name, description, positive hourly rate in whole PHP pesos, and a canvas photo. The shared canvas editor stores one photo/Markdown/video page per service with drag/resize and customer/card previews. Services save directly as public active records; full-content edits use `expectedUpdatedAt`, and archive hides a record. Migrated rates may be null and canvas photos may be absent for reads, but current saves require complete valid input. Service categories are removed. The current package catalog does not assign services to packages. |
| Venue catalog | Maintain standalone flat venue records and expose active, non-archived entries publicly. Show featured venues on `/` after packages and services, with detail preview and View more overlay for the full catalog. Fields: name, location, description, maximum guest count plus one photo/Markdown/video canvas page. Saves require a name, location, description, and a positive maximum guest count; photos are optional. Migrated venues may have null capacity and no photos for reads. The flat-catalog migration retains the current published content, or archives the latest content if no version was published; archived records stay archived. Back up before deployment if version history matters. Google Maps pinning is deferred until an API key is available. Venue records do not establish availability or reservations. |
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
- What are the exact package tiers, maximum guest counts, and fixed PHP prices?
- Which amenities are included in each package, and which add-ons can actually be sold? Can an add-on be booked for more than one event at a time?
- How much is the reservation fee, when is it due, and does a date have a temporary hold before payment?
- What are the rules for fee refunds, cancellation, rescheduling, balance payment, and guest-count changes?
- Does a booking require staff approval after payment verification?

Until these are confirmed, use configurable terms and staff review rather than imply a fixed policy.
