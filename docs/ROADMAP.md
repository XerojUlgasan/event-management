# Clemora backend roadmap

Updated: 2026-11-02. This inventory includes the implemented catalogs and booking-request intake flow. [FEATURES.md](FEATURES.md) defines the intended wider business workflow and rules still to confirm.

## Where the product stands

| Area | Current implementation | Work needed |
| --- | --- | --- |
| Website and navigation | `/` mounts the Clemora React app with featured packages, services, and venues. View more opens a catalog overlay. Public, customer, and admin layouts exist. See [App](../apps/web/src/components/app/App.tsx) and [index.astro](../apps/web/src/pages/index.astro). | Connect business actions to real records. Preserve the approved layouts while replacing sample content and misleading success states. |
| Identity | Registration, local login, optional Firebase sign-in/linking, session restoration, logout, and database roles have API and browser code. See [web API](../apps/web/src/lib/api.ts), [auth controllers](../apps/api/src/controllers/auth/index.ts), and [schema](../apps/api/prisma/schema.prisma). | Add server-side admin checks and customer record ownership for every business route. Validate current auth changes with their integration suite before treating them as a release gate. |
| Public booking request | Published package previews offer Book now. Signed-in customers submit a short inquiry directly. A signed-out visitor keeps a tab-scoped draft through sign-in, reviews it, and submits as a customer. The API returns a real reference. | Add request-linked detail collection, availability checks, quote approval, and date holds as separate stages. |
| Customer workspace | Packages reads the published catalog; My events reads the customer's persisted requests and allows cancellation with a reason. Messages also use the API. Quotes, payments, notifications, and profile edits retain demo or local behavior. | Connect approved quotes, payment evidence, and confirmed event status as their backend stages land. Never infer payment or confirmation from a button click. |
| Admin workspace | Packages, Services, and Venues create and edit complete flat records that publish directly; archive hides records from public reads. Bookings lists real requests and records staff status changes with reasons; overview metrics and other operational screens remain fixtures. | Add availability, quotes, payments, and event preparation. Derive overview figures from records. |
| Extra prototype screens | Inventory, Operations, and Reports components exist but are not in the current sidebar; Team is a view key that falls through to a generic page. Their content is sample/local. See [AppShell](../apps/web/src/components/app/AppShell.tsx) and [Sidebar](../apps/web/src/components/app/Sidebar.tsx). | Defer broad inventory, team optimization, and reporting until the core booking records work and the business needs them. |
| API and database | `/v1` mounts health, auth, package, service, message, and booking-request routes. PostgreSQL stores booking requests with package name, price, and guest-maximum snapshots, plus status history. Quote, confirmed-booking, and payment tables do not exist. See [app.ts](../apps/api/src/app.ts) and [schema](../apps/api/prisma/schema.prisma). | Add the remaining business schema, routes, authorization, and behavior tests one workflow at a time. |

The remaining mock data is **not business policy**. It includes 180–300 guest examples and 2025 events. Published package maximum guest counts are catalog estimates; new booking requests collect guest counts during staff follow-up. Displayed peso figures outside the catalog remain sample values; do not treat them as approved prices. See [data](../apps/web/src/components/app/data.ts) and [FEATURES.md](FEATURES.md).

## Booking-request slice delivered

The first request workflow collects event type, preferred date, estimated event length (one through six days, one week, more than one week with an exact day count, or unspecified), and contact name and phone. The dropdown combines each package’s event types with Birthday, Wedding, Corporate, and **Not on the list**, which asks for a description. Exact start/end times and venue preference are left unknown until follow-up; optional notes can supply more context. A customer session is required. Requests identify the current package record and snapshot its name, price, and guest maximum at submission; `packageUpdatedAt` is optional and rejects a stale package view with `409`. New requests start **Under review**. Staff may set **Needs details**, **Accepted for processing**, **Declined**, or **Cancelled** with history; customers may cancel their own requests with a reason. Acceptance means staff will process the request. It does not confirm a booking, hold a date, or approve a final price.

The customer and manager screens read the same PostgreSQL record and show missing exact times or venue as **To be confirmed**. Signed-in customers submit from the short form. Signed-out drafts are held in the current browser tab until login, then require an explicit review and submit. The API enforces ownership, role checks, a date of today or later in the submitted time zone, and a currently published package; new requests omit guest counts, while requests may retain a count gathered during follow-up. General customer-admin messages and the **Needs details** status support follow-up, but they do not yet update the structured deferred fields on a request.

The focused API suite covers invalid input, anonymous access, ownership, staff access, status transitions, and database persistence. Browser QA should still verify the local login handoff and both workspaces when releasing changes.

## Delivery order for the remaining workflow

| Order | Backend capability and frontend connection | Done when |
| --- | --- | --- |
| 2. Catalog (packages, services, and venues implemented) | All three catalogs use flat records with direct saves, one canvas page per entity, `expectedUpdatedAt` concurrency checks, and archive behavior. Packages store fixed totals in whole PHP pesos; services require positive hourly rates and a legacy or canvas photo; venues require positive capacity and allow photo-free records. There is no package-service assignment. Service and venue availability still need business rules and implementation. | Public and staff views read the same saved catalog record. Future quotes should snapshot package name, price, guest maximum, and any separately approved quote items. |
| 3. Availability | Model venue periods, exclusive-use rules, setup/cleanup buffers, temporary holds if approved, and limited add-ons. Show the calendar from records. Enforce conflicts in the database/transaction, including simultaneous attempts. | Staff can check a requested date, and competing confirmations cannot secure the same exclusive period. An inquiry itself does not reserve a date. |
| 4. Quotes | Turn an inquiry into an itemized, versioned staff-approved quote with package/add-on snapshots, total, reservation fee, balance, validity, and terms. Connect admin quotations and customer review/approval. Calculate money on the server in minor units. | A customer sees the exact issued version; revisions retain history and require approval when terms change; expired quotes cannot be accepted as current. |
| 5. Reservation and payment | Track fee due, payment reference/proof, staff verification, balance, due date, and an idempotent fee credit. Confirm a booking only after the agreed rules and final availability check succeed. Connect booking status and payment screens. A gateway can follow later. | A UI click cannot mark money received; the fee is credited once; a confirmed date cannot conflict; customer and staff see the same status and balance. |
| 6. Event delivery | Build one approved event plan from the confirmed booking, with guest count, menu, layout, included services, add-ons, contacts, and instructions. Add preparation checklists and approved-change history; then connect relevant operations screens and notices/messages. | Staff prepare from the current approved plan and can see who approved a change and which work it affected. |
| 7. Derived features | Compute overview/reports from recorded inquiries, quotes, bookings, and payments. Add feedback/past events if useful. Ground the assistant in approved catalog, terms, and live availability, with staff handoff for exceptions. | Reports reconcile to source records; the assistant cannot invent prices, verify payments, or promise a date. |

The catalog lifecycle, CRUD routes, and frontend contracts are detailed in [Package catalog implementation](PACKAGES_CRUD_DRAFT.md) and [Service catalog](SERVICES.md).

This order follows the journey: **inquiry → approved catalog/availability → quote → verified fee and booking → event plan → reporting and assistance**. Build and test each API slice with its visible customer/staff screen.

## Decisions needed before their dependent stages

Record these with the business using one recent real inquiry and its changes. They do not block the booking-request slice, but they do block claims about prices, availability, payment, and confirmation.

- Before real package publication and quotes: exact package tiers, approved fixed PHP amounts, included amenities versus paid add-ons, add-on capacity, and approved terms.
- Before availability: one event per date versus time slots, setup/cleanup buffers, hold rules, and the point at which a date is secured.
- Before payment/confirmation: fee amount and deadline, acceptable methods, who verifies payment, balance due date, refunds, cancellation, rescheduling, guest-count changes, and whether staff approval is required after payment.
- Before quote revision and notices: quote expiry, who approves custom prices/changes, delivery channel, and which changes require customer reapproval.
- For a future anonymous inquiry channel: decide whether it should exist separately from the current signed-in booking request and how staff would associate it with an account.

## Verification and working rules

- Use Prisma migrations for schema and generated Kysely types for runtime queries; use the existing OpenAPI route style. Check authorization at the API, not through hidden buttons. See the [API guidance](../context-factory/api/SKILL.md).
- For each slice, verify the route, database effect, OpenAPI response, browser action, reload, and a failure path. Run the closest workspace checks; auth integration tests need local PostgreSQL and the Firebase emulator. A build alone does not prove booking behavior.
- Preserve the existing working-tree auth/setup changes while starting business work. This roadmap records what the current source contains and does not validate those uncommitted changes.
- Keep detailed equipment inventory, staff scheduling optimization, supplier management, advanced analytics, and gateway integration outside the initial release unless operations show they are required. Ticketing and attendee registration are outside the current package-and-venue scope.
