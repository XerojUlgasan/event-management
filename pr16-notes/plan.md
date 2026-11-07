# PR 16 — phased implementation plan

| Field | Value |
| --- | --- |
| Status | Phase 4 complete. Phase 5 next. |
| Created | 2026-11-06 |
| Basis | `reference.md` (PR 16 proposal review) at checkout `err12` / `1220ab7` |
| Audience | Future engineering sessions working one phase at a time |
| Local-only | Yes. Excluded via `.git/info/exclude`; do not commit unless the user asks. |

> Phase 0 is complete: the README keeps both intake flows (this plan implements package-first only), package inclusions are approved, preferred venue is free text, guest count is optional, and the inclusion snapshot is JSONB. Answers live in `decisions.md`. If a later phase changes a decision, update `decisions.md` before touching code.

---

## 1. How to run a phase

Every phase prompt must follow this protocol. The goal is to prevent scope creep, mixed changes, and invented behavior.

1. **Read first:** this file, `reference.md`, `decisions.md`, `AGENTS.md`, the relevant area skill(s), and the senior-developer workflow.
2. **Confirm the phase:** restate the phase goal, in-scope items, out-of-scope items, and dependencies in the response before editing.
3. **Check current state:** inspect the actual source, migrations, scripts, and tests. The plan's file list is a starting point, not proof.
4. **Stop on drift:** if the code or requirements contradict the plan, stop and report the conflict. Update `plan.md`/`reference.md` only after the user agrees.
5. **Implement only this phase:** do not start the next phase, do not silently add pricing/payment features, and do not touch unrelated working-tree changes.
6. **Verify:** run the phase's acceptance checks and inspect the final diff, including untracked files.
7. **Hand off:** report what changed, evidence, unresolved decisions, and the next phase. Update the status table.

### Phase prompt template

```text
Phase <N> — <name>.
Read pr16-notes/plan.md (only Phase <N>), pr16-notes/reference.md,
pr16-notes/decisions.md, AGENTS.md,
and the area skills for this phase.
Before editing, inspect the current implementation and confirm the phase dependencies.
Do not start Phase <N+1>.
Implement the phase scope, verify it with the listed evidence, then stop and report.
```

### Phase status

| Phase | Name | Depends on | Status |
| --- | --- | --- | --- |
| 0 | Decisions and scope lock | — | Complete (2026-11-06) |
| 1 | Package inclusions model | 0 (D2, D10) | Complete (2026-11-06) |
| 2 | Booking intake and snapshots | 0 (D1, D4, D9), 1 | Complete (2026-11-06) |
| 3 | Customization requests and arrangement editor | 0 (D5, D7, D11), 2 | Complete (2026-11-07) |
| 4 | Quotation model and service | 0 (D3, D6, D8), 3 | Complete (2026-11-07) |
| 5 | Admin quotation builder UI | 4 | Not started |
| 6 | Conversation delivery and customer acceptance | 5, 0 (D11) | Not started |
| 7 | Permissions, audit, and lifecycle hardening | Executed phases 3–6 | Not started |
| 8 | End-to-end verification and documentation | All executed phases | Not started |

---

## 2. Shared constraints

- **Database:** edit `apps/api/prisma/schema.prisma`, create a new migration, review the SQL, then run `pnpm db:generate`. Never edit an applied migration or hand-edit `apps/api/src/db/types.ts`.
- **API layout:** controllers in `apps/api/src/controllers/<domain>/`, business rules in `services/<domain>/`, Kysely queries in `data/<domain>/`. Follow the existing `createXRoute` / `createXService` / `createXData` naming.
- **Contracts:** shared limits go in `packages/contracts/src/limits/`; catalog collection caps currently live in `packages/contracts/src/catalog.ts`. API-only body caps go in `apps/api/src/constants/http.ts`. Do not duplicate limit values.
- **Scope boundaries:** no payments, invoices, receipts, balances, inventory, suppliers, AI replies, availability engine, or external channels unless the user separately authorizes them.
- **Immutability:** the original package and the original customer request must remain unchanged. Customization applies to a booking-specific arrangement and quotation only.
- **Verification:** use the closest integration suite plus browser/DB evidence for user journeys; `pnpm check` or `pnpm build` alone is not proof.
- **Docs:** update `README.md` and affected current docs in the phase that changes behavior. Do not rewrite historical interview transcripts.
- **Local notes:** keep `plan.md`, `reference.md`, and `decisions.md` in `pr16-notes/`; do not commit them.

---

## 3. Phase 0 — Decisions and scope lock

**Goal:** resolve the business and technical decisions that would otherwise leak across phases.

**Depends on:** nothing.

**Deliverable:** `pr16-notes/decisions.md` recording each decision, the chosen option, the date, and the owner. No product code.

### Decision register

Resolve D1–D11 and T1–T10 in `reference.md` §5; record the answers in `decisions.md`. Do not duplicate the register here.

Resolve in this order:

- Before Phase 1: D2, D10.
- Before Phase 2: D1, D4, D9, T2, T8.
- Before Phase 3: D5, D7, D11, T1, T7, T9.
- Before Phase 4: D3, D6, D8, T3–T6, T10.
- Before Phase 7: the final role matrix and implementation of the T7 audit table.

**Exit gate:** every decision needed by the next phase is answered or explicitly deferred with the phase that will resolve it. If D2 is deferred, Phase 1 is skipped, Phase 2 skips the inclusion snapshot, and Phase 3 relies on free-form quotation lines.

**Do not:** write schema, API, or UI code in this phase.

---

## 4. Phase 1 — Package inclusions model

**Goal:** let an admin attach existing services to a package and mark each as included or optional.

**Depends on:** Phase 0 decisions D2 = approved and D10 (service lifecycle), both recorded in `decisions.md`.

### In scope

- New join model between packages and services with an inclusion type (`included` / `optional`) and a stable display order. Use `included`/`optional` consistently; the historical table used `add_on`, but do not revive its version-based shape.
- Migration, Prisma relation, Kysely types.
- Package create/update/read schemas and services include the assignments.
- Validation: only published, non-archived services can be attached; no duplicate service per package; bounded list length in `packages/contracts/src/catalog.ts` (or a new `limits/packages.ts` if the team prefers a domain file).
- Admin package editor: choose services, mark included/optional, reorder.
- Public package detail: show included and optional services distinctly.
- Delete/archive rules per D10: archive may stay allowed but must be hidden from new attachments; deletion stays blocked while referenced. Existing references should be hidden from public package detail or marked unavailable rather than silently disappearing. Use `onDelete: Cascade` for `package_id` and `Restrict` for `service_id` so the existing `23503` handling still reports "Referenced services cannot be deleted; archive instead."

### Out of scope

- Changing package prices or service rates.
- Snapshotting inclusions onto bookings (Phase 2).
- Quotation pricing or line items.
- Booking UI.

### Likely files

- `apps/api/prisma/schema.prisma`, new migration.
- `apps/api/src/controllers/packages/`, `services/packages/`, `data/packages/`.
- `apps/api/src/controllers/services/` (reference checks/deletion).
- `packages/contracts/src/catalog.ts` (or a new `packages/contracts/src/limits/packages.ts`).
- `apps/web/src/components/app/pages/PackagesPage.tsx`, `apps/web/src/components/app/PackagePreview.tsx`, `apps/web/src/components/PublicCatalog.tsx`, `apps/web/src/lib/api.ts`.
- `apps/api/tests/packages.test.ts`.

### Steps

1. Inspect current package create/update/read flow and the canvas editor.
2. Add the join table with FKs, uniqueness, and archive behavior.
3. Extend Zod schemas and response mappers.
4. Extend create/update services transactionally.
5. Render the assignment in the admin editor and public preview.
6. Add tests for create, update, duplicate, archived service, and package deletion.

### Acceptance evidence

- `pnpm db:validate`
- `pnpm check`
- `pnpm --filter @event-management/api test:packages`
- Manual admin save/reload and public preview in the browser.
- Database inspection of the join rows.

**Exit gate:** an admin can attach, mark, reorder, and remove services; the public package shows them; archived services are not attachable; existing packages still save.

---

## 5. Phase 2 — Booking intake and snapshots

**Goal:** capture an optional guest count and a free-text preferred venue at submission, and snapshot the package inclusions that the quotation will start from.

**Depends on:** Phase 0 (D1, D4, D9, T2, T8) and Phase 1 (D2 approved).

### In scope

- Add an optional `guestCount` field to the customer form. A positive integer is validated when provided; blank means "not sure" and stores `null` (D9).
- Add the free-text preferred-venue field per D4 and enforce `MAX_PREFERRED_VENUE_LOCATION_LENGTH` in the API and the form hint. Do not add a venue foreign key.
- API create schema accepts `guestCount` (nullable) and the venue text; stop hardcoding `preferred_venue_location` to null.
- Snapshot package inclusions as a JSONB array per T2 (`{ serviceId, name, role, sortOrder }`) in the same transaction as the request.
- Return the new fields in customer/admin responses and display them.
- Keep `outOfRange` meaningful: compare guest count with the snapshotted package maximum when a count exists; leave it false when null (T8).
- Update the booking review screen to show the new fields.

### Out of scope

- Editing the arrangement after submission (Phase 3).
- Quotations.
- Automatic availability or reservation logic.
- Requirements-first intake (deferred by D1).

### Likely files

- `apps/api/prisma/schema.prisma`, new migration.
- `apps/api/src/controllers/booking-requests/schemas.ts`.
- `apps/api/src/services/booking-requests/booking-requests.ts`.
- `apps/api/src/data/booking-requests/`.
- `packages/contracts/src/limits/booking-requests.ts`.
- `apps/web/src/components/app/BookingRequest.tsx`, `apps/web/src/components/app/BookingList.tsx`, `apps/web/src/lib/api.ts`.
- `apps/api/tests/booking-requests.test.ts`.

### Steps

1. Confirm the JSONB snapshot shape recorded in `decisions.md` (T2).
2. Add the schema and migration.
3. Extend create/read schemas and service validation.
4. Update the form, review screen, and admin detail view.
5. Add tests for optional/null guest count, text limits, inclusion snapshot immutability, and legacy nulls.

### Acceptance evidence

- `pnpm check`
- `pnpm --filter @event-management/api test:booking-requests`
- Signed-in customer submission with and without a guest count, and with venue text.
- Database check that the inclusion snapshot matches the package at submission time.
- Catalog edit afterward does not change the request.

**Exit gate:** a submitted request stores the optional guest count, the venue text, and the inclusion snapshot; the UI displays them; the text limit is enforced.

---

## 6. Phase 3 — Customization requests and arrangement editor

**Goal:** separate the immutable customer request from an admin-editable arrangement, and record the eight customization request types.

**Depends on:** Phase 0 (D5, D7, D11), Phase 2.

If D7 chooses chat-only, skip the `customization_request` table and keep the arrangement plus audit trail; otherwise build the structured request records below.

### In scope

- Mutable `booking_arrangement` per booking: current event date/time, guest count, preferred venue text, notes, last editor.
- `customization_request` records: type (the eight types), description, requester, decision status (`requested`, `approved`, `rejected`, `withdrawn`), decision reason, decider, timestamps.
- Optional link to the chat message that introduced the request (per D7).
- Customer endpoint/UI to submit a typed request (from the request-linked conversation).
- Admin request queue/details: approve or reject with a reason.
- Admin arrangement editor: update event details and record approved adjustments; recompute `outOfRange` when guest count changes.
- Permissions: customer owns their request and booking; System Administrator edits/decides. Note that ordinary staff can read booking requests but cannot read admin conversations today, so "staff read-only" applies to the booking record, not the chat.
- Apply D11 so the request-linked conversation stays open long enough to submit and decide requests; a closed thread must not strand the workflow. Update `apps/api/src/utils/conversation-expiry.ts`, its tests, and the README expiry statement together.
- Audit columns for every write.

### Out of scope

- Prices, deductions, and quotation lines (Phase 4).
- Customer acceptance of an arrangement.
- Confirmed-booking workflow.

### Likely files

- Schema + migration for arrangements and customization requests.
- Arrangement endpoints under `apps/api/src/controllers/booking-requests/`; customization requests in a new `controllers/customization-requests/`, `services/customization-requests/`, `data/customization-requests/` per T9.
- Message linking if D7 requires it.
- Admin booking details UI and customer conversation UI.
- New `apps/api/tests/customization-requests.test.ts` plus a `test:customization-requests` script in `apps/api/package.json`.

### Steps

1. Define the arrangement shape and what stays immutable on the original request.
2. Create the migration and Kysely types.
3. Implement customer request creation and admin decisions transactionally.
4. Build the admin arrangement editor and request queue.
5. Add the customer request composer and status display.
6. Test ownership, role denial, invalid transitions, and concurrent edits.

### Acceptance evidence

- `pnpm check`
- `pnpm --filter @event-management/api test:customization-requests`
- Browser: customer submits each request type; admin approves/rejects; customer sees the decision.
- Database: original request unchanged; arrangement reflects approved changes.

**Exit gate:** all eight request types are recorded and decided when D7 is structured (chat-only mode records only the conversation/audit trail); the arrangement is editable only by the authorized role; the original request remains intact.

### Completion note (2026-11-07)

Implemented as planned, with the deferred decisions resolved as recorded in `decisions.md`:

- `booking_arrangements`, `customization_requests`, and `audit_events` tables with a backfill for existing requests; the original request row and package snapshot stay immutable.
- System Administrator arrangement edits under `booking-requests`, with optional `expectedUpdatedAt`, `409` on stale writes, closed-request rejection, advisory `outOfRange` recomputation, and before/after audit metadata.
- Customer creation and withdrawal plus System Administrator decisions and a staff-readable queue under the new `customization-requests` domain; optional conversation/message links are ownership-checked.
- Booking responses include the arrangement, customization requests, and pending count; customer, staff, and admin booking list/detail UI covers the arrangement, request composer, decisions, withdrawal, and queue.
- D11 expiry: linked threads stay open for active bookings, close 24 hours after a known event end, and stay open while a pending customization request exists. `expiresAt` is nullable.
- Verification: `pnpm check` passed with only the pre-existing `Badge` hint; `test:customization-requests` passed 4/4, and `test:booking-requests` 3/3 and `test:messages` 8/8 still pass. Browser journeys were not exercised in this phase.

---

## 7. Phase 4 — Quotation model and service

**Goal:** persist versioned, itemized, manually priced quotations with explicit states and an acceptance API.

**Depends on:** Phase 0 (D3, D6, D8), Phase 3.

### In scope

- `quotation` per booking with monotonic `version`, PHP currency, server-computed totals, state, creator, and sent/accepted/superseded timestamps. Add expiry only if D8 enables it.
- Store `baseAmountMinor` from the package snapshot; total = base + additions − deductions.
- `quotation_item` lines per T10: positive `amountMinor`, `direction` (`add`/`deduct`), a `kind` label (`addition`, `deduction`, `substitution`, `adjustment`), description, optional service link, optional `customization_request_id`, sort order. A substitution is a deduction line plus an addition line, not a separate amount formula.
- Admin create/update draft, send, and list history.
- Customer read the latest active quotation; accept or request revision.
- Rules: only the latest `sent` quotation is acceptable; sending a new version supersedes the previous sent one; line items on accepted/superseded quotes are immutable (state changes are allowed); stale writes return `409` using the existing `expectedUpdatedAt` pattern.
- A revision draft copies the previous version's line items. After acceptance, a new version requires a recorded revision request.
- Enforce version uniqueness with `UNIQUE (booking_request_id, version)` plus partial unique indexes for at most one `sent` and one `accepted` quote per booking. Partial indexes need raw SQL in the migration; Prisma may not represent them in `schema.prisma`.
- Totals computed server-side; client never supplies the final total.
- Quote acceptance does **not** change booking confirmation or imply a reservation.
- Audit: who created, sent, accepted, or revised.

### Out of scope

- The builder UI (Phase 5).
- Chat rendering (Phase 6).
- Payments, invoices, tax engines, discounts.

### Likely files

- Schema + migration for quotations and items.
- New `controllers/quotations/`, `services/quotations/`, `data/quotations/`.
- Booking-request read models for the latest quotation.
- New `apps/api/tests/quotations.test.ts` plus a `test:quotations` script in `apps/api/package.json`.

### Steps

1. Define state transitions and the version uniqueness constraint.
2. Add the schema, migration, and Kysely types.
3. Implement draft CRUD and server-side totals.
4. Implement send/supersede and customer accept/revision in transactions with row locks.
5. Enforce ownership and role permissions.
6. Test totals, transitions, concurrency, and stale updates.

### Acceptance evidence

- `pnpm check`
- `pnpm db:validate`
- `pnpm --filter @event-management/api test:quotations` (including two concurrent sends/accepts).
- Database inspection of versions, states, and totals.

**Exit gate:** a booking can hold multiple quotation versions; at most one is `sent` (the active quote) and one is `accepted`; the customer can accept/revision the latest active quote; history is retained; no payment data exists.

### Completion note (2026-11-07)

Implemented the quotation persistence and API service. Drafts support server-computed totals and ordered line items; sending supersedes the prior sent version; customer acceptance and revision drafts are ownership-checked and transactional; quote acceptance does not change booking confirmation. Phase 5 remains responsible for the admin builder UI, and Phase 6 remains responsible for chat delivery.

Verification: `pnpm check`, `pnpm db:validate`, `pnpm db:check`, `pnpm --filter @event-management/api test:quotations` (3/3 including concurrent sends/accepts), and booking-request regression tests passed. Browser quotation UI was not exercised because it is Phase 5 scope.

---

## 8. Phase 5 — Admin quotation builder UI

**Goal:** let the admin build and send an itemized quotation from the arrangement, package snapshot, and approved requests.

**Depends on:** Phase 4.

### In scope

- Quotation panel in the admin booking details.
- Show the original package and base price, inclusions, event details, venue, guest count, and approved customization requests.
- Add/edit/remove line items with description, add/deduct direction, and an amount entered in pesos but sent as `amountMinor`.
- Reference existing service rates as a convenience, but allow manual amounts.
- Save draft, send, and view version history.
- Show the server-computed total and prevent sending a quote with no line items, a missing description, a non-positive amount, or a negative total.
- Clear labeling: estimated quotation, not a confirmed booking.

### Out of scope

- Customer acceptance UI (Phase 6).
- Automatic pricing rules.
- PDF generation or email delivery.

### Likely files

- `apps/web/src/components/app/pages/BookingsPage.tsx`, `apps/web/src/components/app/BookingList.tsx`.
- New quotation components under `apps/web/src/components/app/`.
- `apps/web/src/lib/api.ts`.
- Styles in `apps/web/src/styles/`.

### Steps

1. Inspect the current booking details dialog and panel patterns.
2. Add quotation state/loading/error handling to the admin screen.
3. Build the line-item editor and totals display.
4. Wire draft save and send.
5. Add version history and stale-edit handling.
6. Verify keyboard, labels, and error states.

### Acceptance evidence

- `pnpm check`
- `pnpm build`
- Browser: create a draft, edit lines, send, reload, view history.
- API/database: total and line items match exactly.

**Exit gate:** an admin can produce and send a correct itemized quotation without direct database edits.

---

## 9. Phase 6 — Conversation delivery and customer acceptance

**Goal:** deliver the quotation into the request-linked conversation and let the customer accept or request revisions.

**Depends on:** Phase 5, plus D11 and the message-link decision (T5) from Phase 0.

### In scope

- Link a sent quotation to a conversation message (message type or nullable `quotation_id`).
- Render a quotation card in the thread with version, total, and status.
- Customer quotation view: latest active quote, line items, accept, request revision.
- Requesting a revision creates a customer message and returns the quote to the admin for a new version.
- Only the latest active quote can be accepted; accepted/superseded quotes are read-only.
- Preserve history and show the accepted version.
- Clarify in the UI that acceptance is not booking confirmation.
- Apply D11 so a closing/closed conversation does not hide or block the active quotation; define the reopen/extension behavior here if not already handled in Phase 3.

### Out of scope

- Payments/deposits.
- Email/SMS/push notifications.
- AI assistance.

### Likely files

- `apps/api/prisma/schema.prisma` (message link if not added earlier).
- `apps/api/src/controllers/messages/`, `services/messages/`, `data/messages/`.
- `apps/api/src/controllers/quotations/` (accept/revision).
- `apps/web/src/components/app/messages/MessagesWorkspace.tsx`, `thread.ts`.
- Customer booking/quotation components.

### Steps

1. Add the message–quotation association and response shape. `Message.body` is currently non-null, so either generate a short body ("Quotation v1 sent") or make it nullable for quote messages (T5).
2. Render the quote card in both admin and customer threads; the thread response must include the linked quotation or fetch it separately.
3. Wire the Phase 4 accept and request-revision endpoints into the UI; do not reimplement the rules client-side.
4. Handle stale/superseded states (and expired states only if D8 enabled expiry) plus the D11 conversation lifetime with clear messages.
5. Test the two-account journey and conversation refresh.

### Acceptance evidence

- `pnpm check`
- `pnpm --filter @event-management/api test:messages` and `test:quotations`.
- Two-account browser journey: admin sends, customer receives, accepts or requests revision, admin sees the result.
- Database: message link, quote state, and audit timestamps.

**Exit gate:** the quotation is delivered and actionable inside the conversation; no cross-account access is possible; acceptance is not treated as confirmation.

---

## 10. Phase 7 — Permissions, audit, and lifecycle hardening

**Goal:** close cross-cutting gaps before final verification.

**Depends on:** Phases 3–6.

### In scope

- Explicit role matrix for every new route: customer, staff, System Administrator. Reflect the current restriction that admin conversations are System Administrator only; do not grant staff chat access by accident.
- Tests for forbidden reads/writes and cross-customer access.
- Audit events per T7 in a dedicated table for arrangement edits, request decisions, quotation create/send/accept/revise.
- Quote expiry only if D8 enabled it; otherwise keep `expires_at` null and skip expiry jobs.
- Stale-write `409` behavior and idempotency/replay considerations.
- Body-size limits for new JSON payloads in `apps/api/src/app.ts` using `apps/api/src/constants/http.ts`; field limits in the contracts package.
- Consistent error messages and empty states.
- Remove or relabel demo quotation copy that implies a working workflow.

### Out of scope

- New product features.
- External notifications or channels.

### Acceptance evidence

- Permission test matrix.
- `pnpm check`, `pnpm build`.
- Targeted API suites.
- Manual role walkthrough (customer, staff, admin).

**Exit gate:** every new route has an ownership/role test; audit records exist; superseded quotes (and expired quotes, if D8 enabled expiry) behave predictably.

---

## 11. Phase 8 — End-to-end verification and documentation

**Goal:** prove the integrated workflow and align the repository documents with reality.

**Depends on:** all phases actually executed (skip any deferred in Phase 0).

### In scope

- Seed fixtures in `apps/api/src/db/seed*.ts`: packages with inclusions, services, venues, a booking, an arrangement, and quotation versions.
- Full verification run: `pnpm check`, `pnpm build`, `pnpm db:validate`, and every registered new API suite.
- End-to-end two-role browser journey from package selection through quote acceptance.
- OpenAPI sanity check at `/openapi.json` for the new routes.
- Database verification of snapshots, versions, totals, and audit rows.
- Update `README.md` product scope and current-implementation tables.
- Update the PR 16 document status **only if that document is added to this repository**; otherwise update `README.md` and note that the PR text is unchanged.
- Record remaining gaps in `pr16-notes/plan.md` and `reference.md`.
- Confirm no payment, availability, or confirmation claims were introduced.

### Out of scope

- Deployment, production Firebase/R2, backups, monitoring.
- Features explicitly deferred in Phase 0.

### Acceptance evidence

- A written evidence summary: commands, results, accounts/roles used, checkout, and any skipped checks.
- Browser screenshots or notes for the customer and admin journeys.
- Database queries showing the final state.
- Final diff review.

**Exit gate:** the documented behavior matches the running app; every deferred item is listed; no unresolved critical finding remains.

---

## 12. Shared definition of done (every phase)

- Scope matches the phase; no next-phase work.
- New migration reviewed/applied; generated types regenerated, not hand-edited.
- Permissions and ownership tested, not just parsed.
- Original request/package snapshots remain immutable.
- No payment, invoice, availability, or confirmation behavior invented.
- Listed tests/commands pass, or the skipped check is reported with its limit.
- Final diff (including untracked files) inspected; affected docs updated.
- `plan.md` status and `decisions.md` updated; handoff names the next phase and blockers.

---

## 13. Known risks

| Risk | Mitigation |
| --- | --- |
| Phase work drifts into the next phase (for example quotation pricing during the arrangement phase). | Enforce the "Out of scope" list and stop at the exit gate. |
| The chat workflow breaks after 24 hours because request-linked conversations expire from creation. | Resolve D11 before Phase 3; test a thread older than 24 hours in Phase 6. |
| Quote acceptance is mistaken for booking confirmation. | Separate fields/states and UI copy; test it. |
| Applied migrations or generated types are edited by hand. | New migration + `pnpm db:generate`; review the diff. |
| The plan is executed against stale line references after the first phase. | Re-inspect source each phase; treat `reference.md` as a snapshot, not authority. |

---

## 14. Change log

| Date | Change |
| --- | --- |
| 2026-11-06 | Initial phased plan created from the PR 16 review. |
| 2026-11-06 | Feasibility/consistency audit: removed duplicated decision table, fixed paths and test-script references, added D9–D11/T9–T10, conversation-expiry handling, and clarified phase boundaries and money representation. |
| 2026-11-06 | Phase 1 complete: `package_services` join, package service assignments in API/UI, archive rules, tests, and guidance updates. |
| 2026-11-06 | Phase 2 complete: optional guest count, free-text preferred venue, immutable JSONB inclusion snapshots, booking UI, tests, and guidance updates. |
