# PR 16 — local reference record

| Field | Value |
| --- | --- |
| Status | Local-only. Not committed, not pushed. Excluded via `.git/info/exclude` (`pr16-notes/`). |
| Captured | 2026-11-06 |
| Repository | `/home/ezio/Downloads/Projects/event-management` |
| Checkout | Branch `err12` at `1220ab7` (`origin/main` and `origin/err12` also at this commit) |
| Source | PR 16 description pasted by the user in chat. The PR itself and its diff were **not** fetched from GitHub. |
| Purpose | Durable evidence base for the phased plan in `plan.md`. Future phase work must check current source again; this file is a snapshot, not the authority. |

> **Important:** This record reflects the description text the user supplied, not the actual PR branch. If the PR contains code or document changes beyond that text, re-read the real diff before relying on this file.

---

## 1. Proposal summary

PR 16 recommends an **admin-managed package customization model**:

1. Customers must select an existing package before booking.
2. Customers submit structured event details (date, guest count, preferred venue).
3. All customization requests go through chat with the admin.
4. Customers cannot edit package inclusions, services, prices, or arrangements.
5. Admins review requests, decide feasibility, modify the booking arrangement, and prepare the quotation.
6. Pricing is manual; each approved adjustment becomes a separate quotation line item.
7. Quotations are versioned; the customer accepts the latest active quotation or requests revisions.
8. Admins manage packages, services, and venues; packages should distinguish included vs optional services; venues should have a guest capacity.
9. Payments and invoices are outside scope.
10. The document is explicitly **findings and recommendations only**, not implemented functionality.

The eight proposed customization types are:

1. Add inclusions/items
2. Remove package inclusions
3. Substitute inclusions
4. Modify inclusions
5. Adjust quantities/guest count
6. Add event hours
7. Change venue
8. Special requirements

---

## 2. Current implementation evidence (baseline `1220ab7`; Phase 1 changes noted)

### 2.1 Catalogs

| Fact | Evidence |
| --- | --- |
| Packages are flat records with name, description, `maxGuests`, whole-peso `price`, publication/archive timestamps, and one canvas page. | `apps/api/prisma/schema.prisma:70-83` |
| Services are flat records with name, description, optional `hourlyRatePesos`, and one canvas page. | `apps/api/prisma/schema.prisma:100-110` |
| Venues are flat records with name, location, description, nullable `maxGuests`, and one canvas page. | `apps/api/prisma/schema.prisma:86-97` |
| Package create/update baseline accepts `name`, `description`, `maxGuests`, `price`, and `sections`; Phase 1 adds `services`. | `apps/api/src/controllers/packages/schemas.ts` |
| Venue saves require a positive `maxGuests`; admin/public reads still allow null for migrated records. | `apps/api/src/controllers/venues/schemas.ts` |
| The historical version-based package-to-service assignment was deliberately removed. The migration drops `package_services`. | `apps/api/prisma/migrations/20261102130000_package_canvas/migration.sql:9` |
| Phase 1 reintroduces a flat `package_services` join (`package_id`, `service_id`, `role`, `sort_order`), independent of the dropped version shape. | `apps/api/prisma/migrations/20261106120000_package_inclusions/migration.sql`; `apps/api/prisma/schema.prisma` |
| The removed table used `role` (`included`/`add_on`), `included_quantity`, `add_on_unit_price_amount_minor`, and `add_on_max_quantity`; it was tied to package versions. | `apps/api/prisma/migrations/20261028150000_services_catalog/migration.sql:16-23` |
| The README lists custom package/service combination configuration as later work. | `README.md:25` |
| Admin CRUD exists for all three catalogs. | `apps/api/src/controllers/packages/`, `services/`, `venues/` |

### 2.2 Booking intake

| Fact | Evidence |
| --- | --- |
| Creation requires a published package (`packageId`) and snapshots package name, price, and max guests. | `apps/api/src/controllers/booking-requests/schemas.ts:7-14`; `apps/api/src/services/booking-requests/booking-requests.ts:20` |
| Intake collects event type, preferred date, estimated duration, time zone, contact name, phone, and optional special requests. | `apps/api/src/controllers/booking-requests/schemas.ts` |
| `guestCount` is accepted at intake and sent by the frontend as an optional field; blank means "not sure". | `apps/api/src/controllers/booking-requests/schemas.ts`; `apps/web/src/components/app/BookingRequest.tsx` |
| `preferredVenueLocation` is accepted as bounded free text and persisted; the arrangement editor can change it later. No venue foreign key exists. | `apps/api/src/controllers/booking-requests/schemas.ts`; `apps/api/src/services/booking-requests/booking-requests.ts` |
| `MAX_PREFERRED_VENUE_LOCATION_LENGTH` bounds the venue text at 1,000 characters. | `packages/contracts/src/limits/booking-requests.ts` |
| `outOfRange` compares a present `guestCount` with the snapshotted package maximum; a null count is in range. | `apps/api/src/services/booking-requests/booking-requests.ts`; `apps/api/src/services/booking-requests/response.ts` |
| Booking requests start as `under_review`; statuses are `under_review`, `needs_details`, `accepted`, `declined`, `cancelled`. | `apps/api/src/controllers/booking-requests/schemas.ts` |
| Admin booking UI updates status, edits the separate arrangement, and decides customization requests. | `apps/web/src/components/app/BookingList.tsx`; `apps/web/src/components/app/BookingCustomization.tsx`; `apps/web/src/components/app/pages/BookingsPage.tsx` |
| Customers can cancel their own open requests; only System Administrators can change review status, edit arrangements, or decide customization requests. | `apps/api/src/controllers/booking-requests/index.ts`; `apps/api/src/controllers/customization-requests/index.ts` |
| Each request has one mutable arrangement separate from the immutable request row, plus customization requests and an audit trail. | `apps/api/prisma/schema.prisma` (`BookingArrangement`, `CustomizationRequest`, `AuditEvent`); `apps/api/prisma/migrations/20261107120000_booking_arrangements_and_customization_requests/migration.sql` |

### 2.3 Messages and conversations

| Fact | Evidence |
| --- | --- |
| A conversation can be linked one-to-one to a booking request. | `apps/api/prisma/schema.prisma:25-40` (`Conversation.bookingRequestId`) |
| Messages are plain text `body` with sender role and read timestamp. Maximum body length is 4,000 characters. | `apps/api/prisma/schema.prisma:43-55`; `packages/contracts/src/limits/messages.ts:1` |
| Request-linked conversations expose booking details, including the current arrangement, to staff and read-only details to customers. | `apps/api/src/services/messages/`; `apps/api/src/controllers/messages/index.ts`; `apps/web/src/components/app/messages/MessagesWorkspace.tsx` |
| Request-linked conversations stay open while the booking is active, close 24 hours after a known event end, and stay open while a customization request is pending. General threads expire 24 hours after creation. `expiresAt` is nullable. | `apps/api/src/utils/conversation-expiry.ts`; `apps/api/src/data/messages/expire-conversations.ts`; `apps/api/src/services/messages/message-response.ts` |
| Admin conversation routes require System Administrator; ordinary staff cannot read admin conversations but can read booking records and the customization queue. | `apps/api/src/controllers/messages/index.ts`; `apps/api/src/controllers/customization-requests/index.ts` |
| There is no quotation reference, attachment, or message-type field. | No `quotation` model/route in `apps/api/src` or `schema.prisma`; `Message` fields above |

### 2.4 Quotations and arrangements

| Fact | Evidence |
| --- | --- |
| `BookingArrangement`, `CustomizationRequest`, and `AuditEvent` models exist (Phase 3). There is still no `Quotation` or `QuotationItem` model. | `apps/api/prisma/schema.prisma` |
| There are no quotation controllers, services, data queries, or routes. | `apps/api/src/controllers/`, `services/`, `data/` |
| Arrangement and customization controllers, services, and data queries exist (Phase 3). | `apps/api/src/controllers/booking-requests/update-arrangement.ts`; `apps/api/src/controllers/customization-requests/` |
| The only quotation UI is demo/marketing copy and CSS, not a persisted workflow. Arrangement and customization UI exists in the booking list and details dialog. | `apps/web/src/components/app/BookingList.tsx`; `apps/web/src/components/app/BookingCustomization.tsx`; `apps/web/src/components/app/AuthPage.tsx`; `apps/web/src/components/app/pages/Overview.tsx` |
| Package snapshots on a booking are immutable with respect to later catalog edits. | `apps/api/prisma/schema.prisma:174-203` |

### 2.5 Recorded product scope

| Fact | Evidence |
| --- | --- |
| Long-term intended scope includes **both** package-start and requirements-first inquiries, staff-prepared custom quotations, revisions, and quotation history. | `README.md` (product scope); `docs/PREVAIL_INTERVIEW_SUMMARY.md:16` |
| PR 16 implements only the package-first path; requirements-first inquiries remain intended scope and are outside this plan. | `decisions.md` D1; `README.md` (product scope) |
| The interview records that Prevail prefers collecting requirements first. | `docs/PREVAIL_INTERVIEW_SUMMARY.md:8` |
| Changes affecting an agreed price or delivery require customer reapproval. | `README.md:14` |
| A request does not reserve a date, establish a final price, or confirm a booking. | `README.md` (Product scope, paragraph after the scope table) |
| Payment responsibilities are outside scope. | `README.md` (Product scope, "Outside scope") |
| Custom package/service combination configuration is later work. | `README.md:25` |

---

## 3. Claim-by-claim verification

Status values: **Implemented**, **Partial**, **Not implemented**, **Conflict**.

| # | PR 16 claim | Status | Evidence / note |
| --- | --- | --- | --- |
| 1 | Customers must start from an existing package | **Implemented subset** | Current app requires a published package. The README keeps requirements-first inquiries as intended scope; PR 16 implements only the package-first path (`decisions.md` D1). |
| 2 | Admin manages packages, services, venues | **Implemented** | CRUD controllers and admin screens exist. |
| 3 | Packages assign existing services, marked included or optional | **Implemented (Phase 1)** | `package_services` join with `role` and `sort_order`; package API accepts `services`, public reads list included/optional, admin reads include archived assignments. |
| 4 | Venues have a maximum guest capacity | **Partial** | Field and save validation exist; reads can be null for legacy rows; capacity is not enforced against bookings. |
| 5 | Customers provide date, guest count, and preferred venue | **Implemented subset** | Package-first intake now collects optional guest count and bounded free-text preferred venue; the request stores them and keeps venue independent of the catalog. Requirements-first intake remains outside this plan. |
| 6 | Customers explore additional services | **Partial** | A public service catalog exists, but services are not linked to packages and there is no add-to-booking action. |
| 7 | Customers submit a booking request | **Implemented** | Persisted in PostgreSQL with status history and a linked conversation. |
| 8 | Customization requests go through chat | **Implemented (Phase 3)** | Structured `customization_requests` records cover the eight types, optional conversation/message links, decisions, withdrawal, and an admin queue. Quotation-specific chat messages remain Phase 6. |
| 9 | Admin reviews and modifies the booking arrangement | **Implemented (Phase 3)** | System Administrators edit a separate `booking_arrangements` row under the booking-request API; the original request stays unchanged. Staff read only. |
| 10 | Admin manually adds/removes/substitutes items and prices | **Not implemented** | No arrangement or quotation line-item model. |
| 11 | Each approved adjustment is a separate quotation item | **Not implemented** | No quotation items exist. |
| 12 | Admin prepares and sends an itemized quotation | **Not implemented** | No quotation persistence; messages are plain text. |
| 13 | Customer accepts the latest active quotation or requests revisions | **Not implemented** | No quote states, versioning, or acceptance endpoint. |
| 14 | Previous quotation versions remain recorded | **Not implemented** | No version model. |
| 15 | Original package remains unchanged | **Implemented (Phase 3)** | Booking snapshots protect name/price/max guests/inclusions, and arrangement edits plus customization decisions never rewrite the original request. |
| 16 | Payment processing and invoices are outside scope | **Consistent** | Matches `README.md` outside-scope statement. |

---

## 4. Action register

The evidence lives in §2 and the claim status in §3. This table is the action list only.

| ID | Priority | Action | Claims |
| --- | --- | --- | --- |
| F1 | High | Keep both flows per README; implement package-first only in this plan. | 1 |
| F2 | Done | Build package inclusions (D2); implemented in Phase 1. | 3, 9–11 |
| F3 | Done | Added optional guest count and free-text venue to intake and snapshotted package inclusions on the request (Phase 2). | 5 |
| F4 | Medium | Keep the recommendations-only disclaimer and add an explicit current-implementation boundary. | 9–14 |
| F5 | Medium | Define the message–quotation link and what the customer sees. | 12 |
| F6 | Medium | Separate quote acceptance from booking confirmation. | 13 |
| F7 | Done | Mapped "admin" to System Administrator; staff remain read-only (D5, Phase 3). | 8, 9 |
| F8 | Done | Chose structured request records linked to the conversation (D7, Phase 3). | 8 |
| F9 | Low | Define line-item shape, totals, and quote states/transitions. | 10–14 |
| F10 | Low | Fix the "Prevails" typo. | — |
| F11 | Done | Request-linked conversations now stay open for active bookings, close 24 hours after a known event end, and stay open while a customization request is pending (D11, Phase 3). | 8, 12, 13 |

---

## 5. Decisions needed before implementation

Resolved answers live in `decisions.md`. The rows below record the question and the original fallback; do not re-derive an answer from the fallback after it has been decided.

### Business decisions

| ID | Decision | Why it blocks work | Current default if unanswered |
| --- | --- | --- | --- |
| D1 | Keep requirements-first inquiries, or adopt package-only for the first release? | Changes intake, conversation, and admin flows. | Resolved: keep both flows; PR 16 implements package-first only (`decisions.md`). |
| D2 | Approve package→service assignment now? | Blocks Phase 1 and the inclusion request types. | Resolved: build inclusions now (`decisions.md`). |
| D3 | Included vs optional service semantics: does an included service carry a value for deductions? | Affects quotation line items and totals. | Included items are non-priced; deductions are manual. |
| D4 | Is "preferred venue" a venue-catalog reference, free text, or both? | Affects schema, validation, and capacity checks. | Resolved: free text only, no venue FK (`decisions.md`). |
| D5 | Which roles edit arrangements and quotations? | Affects permissions and API middleware. | Resolved: System Administrator only; staff read-only; customers submit requests (`decisions.md`). |
| D6 | Does quote acceptance confirm a booking? | Affects status model and customer messaging. | No; confirmation remains a separate staff decision. |
| D7 | Are customization requests structured records or chat-only? | Affects schema, admin queue, and audit. | Resolved: structured records with optional conversation/message links (`decisions.md`). |
| D8 | Are there standard charges/deductions, quote expiry, and revision limits? | Affects pricing UI and quote states. | Manual amounts; no automatic expiry in the first release. |
| D9 | Is guest count required at submission, or can it be "not sure"? | Affects intake validation and capacity checks. | Resolved: optional at intake, null allowed (`decisions.md`). |
| D10 | Can a service attached to a package be archived or deleted? | Affects package editing, public display, and FK behavior. | Resolved: archive allowed, delete blocked while referenced, public reads omit archived (`decisions.md`). |
| D11 | How long should a request-linked conversation remain open? | The current 24-hour creation-based expiry blocks chat-only customization and quotation delivery. | Resolved: open while active, 24 hours after a known event end, and while a customization request is pending (`decisions.md`). |

### Technical decisions

| ID | Decision | Notes |
| --- | --- | --- |
| T1 | Arrangement model | Resolved: separate mutable `booking_arrangements` from the immutable request snapshot (`decisions.md`). |
| T2 | Inclusion snapshot | Resolved: JSONB array on the booking request (`decisions.md`). |
| T3 | Quotation versioning | Monotonic `version` per booking; one active sent quote; history retained. |
| T4 | Line-item shape | Kind label (`addition`, `deduction`, `substitution`, `adjustment`), positive `amountMinor`, explicit add/deduct direction, description, sort order, optional service link. |
| T5 | Message–quotation link | Nullable `quotation_id` on messages or a message type; decide rendering and authorization. |
| T6 | Quote states | `draft`, `sent`, `accepted`, `superseded`, `expired`, `withdrawn` (pick the minimum). |
| T7 | Audit | Resolved: dedicated `audit_events` table with actor, action, entity type/ID, JSONB metadata, and timestamp; Phase 3 writes arrangement and customization events (`decisions.md`). |
| T8 | Capacity behavior | Resolved: advisory only; no availability or confirmation rules (`decisions.md`). |
| T9 | API ownership | Resolved: arrangement endpoints under `booking-requests`; customization requests in a new `customization-requests` domain (`decisions.md`). |
| T10 | Money and line items | Store PHP `amountMinor`; use a positive amount plus an add/deduct direction. Store `baseAmountMinor` from the package snapshot; total = base + additions − deductions. Represent a substitution as a deduction line plus an addition line rather than a special amount formula. |

---

## 6. Verification boundary

This review used source inspection only:

- Read `README.md`, `docs/PREVAIL_INTERVIEW_SUMMARY.md`, Prisma schema, migrations, API schemas/services/controllers, and relevant web components.
- Confirmed the absence of quotation models/routes by searching `apps/api/src` and `schema.prisma`.
- Did **not** run the app, database, browser, or test suites. No behavior was exercised.
- Did **not** fetch PR 16 or its diff from GitHub (private repo, no credentials, `gh` missing).
- Line numbers are valid for commit `1220ab7`; re-check after the first phase changes code.
- Re-audited on 2026-11-06 for plan feasibility: root/API scripts, contract filenames, test script names, and UI paths exist. Also confirmed the unused venue-limit constant, the creation-based conversation expiry, and System-Administrator-only admin messages.
- Phase 3 verification ran `pnpm check`, `test:customization-requests` (4/4), `test:booking-requests` (3/3), and `test:messages` (8/8) against disposable local PostgreSQL databases and the local migration set. Browser journeys were not exercised.

---

## 7. Change log

| Date | Change |
| --- | --- |
| 2026-11-06 | Created from the PR 16 description and a source pass at `1220ab7`. |
| 2026-11-06 | Added the conversation-expiry/role facts, action register, D9–D11, T9–T10, and feasibility audit notes. |
| 2026-11-06 | Phase 0: recorded D1, D2, D4, D9, D10, T2, T8 in `decisions.md`; updated plan phases 0–2. README kept as-is. |
| 2026-11-06 | Phase 1 implemented: flat `package_services` join, service assignments in package API/UI, archive rules, and package tests. |
| 2026-11-06 | Phase 2 implemented: optional guest count, free-text preferred venue, immutable package-inclusion snapshots, booking UI, and booking-request tests. |
| 2026-11-07 | Phase 3 implemented: separate booking arrangements, structured customization requests, admin queue/decisions, audit events, revised conversation lifetime, API and UI integration, and the customization-request suite. The earlier 2.2–2.4 facts and claim rows were refreshed to match current source. |
