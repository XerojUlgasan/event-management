# Clemora backend roadmap

Updated: 2026-10-27. This inventory includes the implemented package catalog and the remaining workflow gaps. The client-approved frontend is the interface target; [FEATURES.md](FEATURES.md) defines the narrower business workflow and rules still to confirm.

## Where the product stands

| Area | Current implementation | Work needed |
| --- | --- | --- |
| Website and navigation | `/` mounts the Clemora React app; `/landing` is a separate informational 3D page. Public, customer, and admin layouts exist. See [App](../apps/web/src/components/app/App.tsx) and [index.astro](../apps/web/src/pages/index.astro). | Connect business actions to real records. Preserve the approved layouts while replacing sample content and misleading success states. |
| Identity | Registration, local login, optional Firebase sign-in/linking, session restoration, logout, and database roles have API and browser code. See [web API](../apps/web/src/lib/api.ts), [auth routes](../apps/api/src/routes/auth/index.ts), and [schema](../apps/api/prisma/schema.prisma). | Add server-side admin checks and customer record ownership for every business route. Validate current auth changes with their integration suite before treating them as a release gate. |
| Public inquiry | Published package cards read the API. Inquiry actions explain that online submission is unavailable; the assistant panel is presentation only. See [PublicSite](../apps/web/src/components/app/PublicSite.tsx). | Persist inquiries, return a real reference, collect contact details, and show actual submission errors/status. |
| Customer workspace | Packages reads the published catalog. Requests, quotes, payments, messages, notifications, and profile edits still use component data/state, and the payment action locally marks a sample booking confirmed. See [CustomerDashboard](../apps/web/src/components/app/customer/CustomerDashboard.tsx). | Fetch only the signed-in customer's records; connect requests, approved quotes, payment evidence, and status as their backend stages land. Never infer payment or confirmation from a button click. |
| Admin workspace | Packages now creates/edits private drafts, publishes versions, archives offers, and deletes eligible drafts through the API. Bookings and Customers still edit local arrays; quotations and metrics are fixtures. See [data](../apps/web/src/components/app/data.ts), [AppShell](../apps/web/src/components/app/AppShell.tsx), and [PackagesPage](../apps/web/src/components/app/pages/PackagesPage.tsx). | Add an inquiry review queue, then availability, quotes, payments, and event preparation. Derive overview figures from those records. |
| Extra prototype screens | Inventory, Operations, and Reports components exist but are not in the current sidebar; Team is a view key that falls through to a generic page. Their content is sample/local. See [AppShell](../apps/web/src/components/app/AppShell.tsx) and [Sidebar](../apps/web/src/components/app/Sidebar.tsx). | Defer broad inventory, team optimization, and reporting until the core booking records work and the business needs them. |
| API and database | `/v1` mounts health, auth, and package routes. PostgreSQL models users, sessions, packages, and package versions; inquiry, quote, booking, and payment tables do not exist. See [app.ts](../apps/api/src/app.ts) and [schema](../apps/api/prisma/schema.prisma). | Add the remaining business schema, routes, authorization, and behavior tests one workflow at a time. |

The remaining mock data is **not business policy**. It includes 180–300 guest examples and 2025 events, while the real package catalog enforces **30–100 guests** and a fixed total in PHP. Displayed peso figures outside the catalog remain sample values; do not treat them as converted or approved prices. Inquiry forms still need contact details and server-side validation. See [data](../apps/web/src/components/app/data.ts), [CustomerDashboard](../apps/web/src/components/app/customer/CustomerDashboard.tsx), and [FEATURES.md](FEATURES.md).

## What to build first

**First backend feature: inquiries from customer to staff.** It is the first useful end-to-end slice and does not require guessing a package price, holding a date, or accepting money.

1. Define one `inquiries` model and its states before adding a generic `bookings` table. Store a generated reference, optional signed-in customer ID, contact name and method, event type, preferred date, estimated guests, special requests, source, status, and timestamps. Treat a package named in the current UI as a *preference*, not an approved price. Record staff status changes with actor and time. Do not automatically attach an anonymous inquiry to an account merely because emails match.
2. Add validated create and read routes using the existing Hono/OpenAPI and Prisma/Kysely patterns. Public submission needs abuse controls; signed-in customers may list only their own inquiries; admins may list and review all inquiries. A public reference alone must not grant access to private details. Apply server-side authorization and request-origin/body rules to new write methods.
3. Connect the public inquiry action and customer request form to that API. The public flow must return a real reference; the customer workspace must show its own persisted requests after reload. Staff should see the same request in an inquiry queue. Counts outside 30–100 go to staff review under the current scope instead of being silently accepted as a standard package.

**Done when:** a submitted inquiry survives a reload, appears for staff, is visible only to its owner where applicable, and cannot falsely become a quote, paid reservation, or confirmed booking. Test invalid input, anonymous access, ownership, admin access, and database persistence. The former fixed public success reference was removed during catalog integration.

## Delivery order after inquiries

| Order | Backend capability and frontend connection | Done when |
| --- | --- | --- |
| 2. Catalog (packages implemented) | Package versions, guest ranges, inclusions, exclusions, terms, admin editing, and published public/customer reads now use PostgreSQL. Prices are fixed PHP totals in centavos. Separate priced add-ons and their availability still need business rules and implementation. | Public and staff views read the same published version; drafts remain private. Future quotes must retain the version and price they use. |
| 3. Availability | Model venue periods, exclusive-use rules, setup/cleanup buffers, temporary holds if approved, and limited add-ons. Show the calendar from records. Enforce conflicts in the database/transaction, including simultaneous attempts. | Staff can check a requested date, and competing confirmations cannot secure the same exclusive period. An inquiry itself does not reserve a date. |
| 4. Quotes | Turn an inquiry into an itemized, versioned staff-approved quote with package/add-on snapshots, total, reservation fee, balance, validity, and terms. Connect admin quotations and customer review/approval. Calculate money on the server in minor units. | A customer sees the exact issued version; revisions retain history and require approval when terms change; expired quotes cannot be accepted as current. |
| 5. Reservation and payment | Track fee due, payment reference/proof, staff verification, balance, due date, and an idempotent fee credit. Confirm a booking only after the agreed rules and final availability check succeed. Connect booking status and payment screens. A gateway can follow later. | A UI click cannot mark money received; the fee is credited once; a confirmed date cannot conflict; customer and staff see the same status and balance. |
| 6. Event delivery | Build one approved event plan from the confirmed booking, with guest count, menu, layout, included services, add-ons, contacts, and instructions. Add preparation checklists and approved-change history; then connect relevant operations screens and notices/messages. | Staff prepare from the current approved plan and can see who approved a change and which work it affected. |
| 7. Derived features | Compute overview/reports from recorded inquiries, quotes, bookings, and payments. Add feedback/past events if useful. Ground the assistant in approved catalog, terms, and live availability, with staff handoff for exceptions. | Reports reconcile to source records; the assistant cannot invent prices, verify payments, or promise a date. |

The catalog lifecycle, CRUD routes, and frontend contract are detailed in [Package catalog implementation](PACKAGES_CRUD_DRAFT.md).

This order follows the journey: **inquiry → approved catalog/availability → quote → verified fee and booking → event plan → reporting and assistance**. Build and test each API slice with its visible customer/staff screen.

## Decisions needed before their dependent stages

Record these with the business using one recent real inquiry and its changes. They do not block the initial inquiry slice, but they do block claims about prices, availability, payment, and confirmation.

- Before real package publication and quotes: exact package tiers, approved fixed PHP amounts, included amenities versus paid add-ons, add-on capacity, and approved terms.
- Before availability: one event per date versus time slots, setup/cleanup buffers, hold rules, and the point at which a date is secured.
- Before payment/confirmation: fee amount and deadline, acceptable methods, who verifies payment, balance due date, refunds, cancellation, rescheduling, guest-count changes, and whether staff approval is required after payment.
- Before quote revision and notices: quote expiry, who approves custom prices/changes, delivery channel, and which changes require customer reapproval.
- For public inquiry: whether anonymous submissions are accepted and how staff contact or later associate them with a customer account. The current public form suggests anonymous submission, so this roadmap assumes it is allowed while keeping account ownership explicit.

## Verification and working rules

- Use Prisma migrations for schema and generated Kysely types for runtime queries; use the existing OpenAPI route style. Check authorization at the API, not through hidden buttons. See the [API guidance](../context-factory/api/SKILL.md).
- For each slice, verify the route, database effect, OpenAPI response, browser action, reload, and a failure path. Run the closest workspace checks; auth integration tests need local PostgreSQL and the Firebase emulator. A build alone does not prove booking behavior.
- Preserve the existing working-tree auth/setup changes while starting business work. This roadmap records what the current source contains and does not validate those uncommitted changes.
- Keep detailed equipment inventory, staff scheduling optimization, supplier management, advanced analytics, and gateway integration outside the initial release unless operations show they are required. Ticketing and attendee registration are outside the current package-and-venue scope.
