# PR 16 — Phase 0 decisions

| Field | Value |
| --- | --- |
| Status | Phase 4 complete. Decisions D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, T1, T2, T3, T4, T6, T7, T8, T9, T10 resolved. T5 remains deferred to Phase 6. |
| Date | 2026-11-06 |
| Owner | User (business decisions); engineering defaults recorded below |
| Basis | `reference.md` §5 and `plan.md` Phase 0, checked against source at `1220ab7` |
| Local-only | Yes. Excluded via `.git/info/exclude`; do not commit unless the user asks. |

> Decisions here are the execution contract for the remaining phases. If a later phase finds source evidence that contradicts one, stop and report before changing code.

---

## 1. Resolved decisions

### D1 — Intake scope

**Decision:** Keep the recorded both-flow scope. README is restored as canonical: customers may start from a package or describe requirements first. This PR 16 work implements the package-first path only; requirements-first remains intended but outside this plan.

**Why:** The user reverted the README because the original scope is better. Do not narrow the product scope to match PR 16's package-only proposal.

**Consequences:**
- No README scope change.
- Phase 2 does not build requirements-first intake.
- PR 16's package-only claim is treated as an implementation subset, not the product scope.
- Requirements-first intake needs its own phase set if prioritized.

### D2 — Package inclusions

**Decision:** Build package→service inclusions now. Phase 1 runs.

**Why:** The eight customization request types (add, remove, substitute, modify) need structured items. Without the join, the workflow degrades to free-form quotation text and cannot attribute an adjustment to a service.

**Consequences:**
- Phase 1 creates the package↔service join with an inclusion role and display order.
- Phase 2 snapshots inclusions onto each booking request.
- Phase 3 request types and Phase 4 line items can reference a service.
- Do not revive the old version-based `package_services` shape. Use current flat package/service records.

### D4 — Preferred venue input

**Decision:** Free-text only. Populate the existing `preferred_venue_location` column from a bounded text field. No venue foreign key, no venue snapshot, and no venue-capacity validation.

**Why:** This is the smallest scope that satisfies the proposal's "preferred venue" detail. The venue catalog remains independent, and the existing `MAX_PREFERRED_VENUE_LOCATION_LENGTH` (1,000 characters) is already defined but unused.

**Consequences:**
- Phase 2 sends and validates the text with the existing limit.
- Venue capacity does not feed `outOfRange`.
- If a structured venue reference is wanted later, it needs a new decision and migration; do not add it speculatively.

### D9 — Guest count at intake

**Decision:** Optional at intake. Allow a null value ("not sure"). Validate a positive integer when provided.

**Why:** The current UI deliberately defers guest count to staff follow-up, and the recorded workflow says staff collect missing details. Requiring it would block customers who do not know yet.

**Consequences:**
- Phase 2 adds the field to the form as optional.
- `outOfRange` stays false when the count is null.
- Staff can record or correct the count during the arrangement phase if that phase supports editing event details.

### D10 — Service archive and delete with inclusions

**Decision:**
- Archiving a service stays allowed and hides it from the public catalog and from the attachment picker.
- A service already attached to a package keeps its assignment. Saving that package again is allowed even if the service is now archived, but new attachments must be non-archived.
- Public package reads omit archived services; admin reads include them with their archived state so staff can replace them.
- Deleting a referenced service stays blocked by the foreign key and returns the existing `409` message.

**Why:** Current behavior already blocks referenced deletes and allows archive. This keeps archive usable without invalidating historical packages or silently stripping their content.

**Consequences:** Phase 1 validates "new attachment must be published and non-archived", not "all attachments must be non-archived". The join uses `onDelete: Restrict` for `service_id` and `onDelete: Cascade` for `package_id`.

### T2 — Inclusion snapshot shape

**Decision:** Store a JSONB snapshot on the booking request, for example `package_inclusions_snapshot`, containing an ordered array of `{ serviceId, name, role, sortOrder }`.

**Why:** A booking read always loads the whole request; there is no requirement to query bookings by service. JSONB avoids a second join table and keeps the snapshot immutable with the request row.

**Consequences:**
- Phase 2 writes the snapshot in the same transaction as the request.
- Rendering reads the snapshot, never the live package/service rows.
- `serviceId` is informational inside the snapshot and is not a foreign key.
- Quotation line items may still store a nullable live `service_id` when the admin references a current service.

### T8 — Capacity behavior

**Decision:** Advisory only. `outOfRange` compares guest count with the snapshotted package maximum when a guest count exists. No capacity enforcement, no availability checks, no date holds.

**Why:** Availability and confirmation rules remain unagreed in `README.md`. A venue record does not establish availability.

**Consequences:** Phase 2 recomputes `outOfRange`; Phases 3–6 may show a warning but must not block on capacity. Phase 3 recomputes the arrangement's `outOfRange` against the snapshotted package maximum when the arrangement guest count changes.

### D5 — Arrangement and quotation editing role

**Decision:** System Administrators edit arrangements and, later, quotations. Ordinary staff keep read-only access to booking records, arrangements, and customization requests. Customers update their own arrangement only through customization requests; they cannot write booking or arrangement fields directly. Customers withdraw their own pending customization requests.

**Why:** This matches the current booking status rule and the README's role split. Arrangement edits and price-affecting work need the System Administrator designation rather than any staff title.

**Consequences:**
- Arrangement routes live under `/v1/admin/booking-requests` and require both `role = admin` and `staff_role = System Administrator`.
- Staff can read booking responses, including the arrangement and customization history, but cannot write them.
- Phase 4 quotation writes follow the same rule; customer acceptance stays a customer action.

### D7 — Structured customization requests

**Decision:** Use structured `customization_requests` records linked to the booking, with an optional `conversation_id` and `message_id`. Chat-only was rejected.

**Why:** The admin queue, decisions, audit trail, and later quotation line references need records that can be filtered and linked. Plain messages cannot carry decision state or reliably attribute an approved change.

**Consequences:**
- The eight contract types are recorded as an enum at the API and database layers.
- A request starts as `requested`; statuses are `approved`, `rejected`, and `withdrawn`.
- Links are optional, ownership-checked, and become null if the conversation or message is removed.
- Decisions never rewrite the original request or package snapshot; Phase 4 may reference an approved request from a quotation line.

### D11 — Request-linked conversation lifetime

**Decision:** A request-linked conversation stays open while the booking is active (`under_review`, `needs_details`, or `accepted`). Once an event end is known, it closes 24 hours after that end, except while a `requested` customization request exists. Declined or cancelled requests close 24 hours after the known event end, or after creation otherwise. General conversations keep the creation-based 24-hour expiry.

**Why:** The previous creation-based expiry closed booking threads before staff and customers could adjust an inquiry. The exceptions keep the workflow and quotation conversation available without leaving threads open forever.

**Consequences:**
- `conversationExpiresAt` returns `null` when no automatic expiry applies; the DTO and client types accept nullable `expiresAt`.
- `expire_conversations` checks the arrangement end, booking status, and pending customization requests before closing.
- Expired linked threads remain closed; only general threads reopen when a customer sends a message.
- Phase 6 quotation delivery reuses this lifetime rule and must not invent a separate expiry.

### T1 — Arrangement model

**Decision:** Store one mutable row per booking in `booking_arrangements`, separate from the immutable `booking_requests` row.

**Why:** The original customer request and package snapshot must remain unchanged for evidence and later comparison. Event changes need their own current-state record with an editor and timestamps.

**Consequences:**
- The migration backfills an arrangement for each existing request; the customer is recorded as the initial editor.
- Arrangement updates use `expectedUpdatedAt` and do not modify `booking_requests` fields.
- `outOfRange` on the arrangement is computed against the request's `package_max_guests`, so later catalog edits cannot move the threshold.

### T7 — Audit trail

**Decision:** Add a dedicated `audit_events` table with a nullable actor, action, entity type and ID, JSONB metadata, and creation time. Arrangement and customization writes record an event in the same transaction.

**Why:** Booking status history only covers review status changes. Before/after values and decisions need a durable, queryable trail that Phase 4 and Phase 7 can extend.

**Consequences:**
- Actions currently recorded: `arrangement.created`, `arrangement.updated`, `customization_request.created`, `.approved`, `.rejected`, `.withdrawn`, and quotation create/update/send/accept/revise events.
- Actors are retained with `ON DELETE SET NULL` so deleting a user does not erase history.
- Phase 4 adds quotation events to the same table; Phase 7 audits coverage.

### T9 — API ownership

**Decision:** Arrangement operations live under `controllers/booking-requests/`, `services/booking-requests/`, and `data/booking-requests/`. Customization requests use the new `customization-requests` domain across all three layers.

**Why:** The arrangement is part of a booking record, while customization decisions have their own queue, statuses, and permissions.

**Consequences:** Routes are `PATCH /v1/admin/booking-requests/{id}/arrangement`, `POST /v1/booking-requests/{id}/customization-requests`, `PATCH /v1/customization-requests/{id}/withdraw`, and `GET`/`PATCH /v1/admin/customization-requests`. Both route groups apply the matching body cap.

---

## 2. Deferred decisions

Resolve these in the named phase; do not invent answers earlier.

| ID | Resolve in | Why it can wait |
| --- | --- | --- |
| T5 (message–quotation link) | Phase 6 | No quotation messages exist before Phase 6. |

---

## 3. Blocking check

No decision needed by Phase 1, Phase 2, or Phase 3 remains open:

- Phase 1 needs D2 and D10 — resolved.
- Phase 2 needs D1, D4, D9, T2, T8 — resolved.
- Phase 3 needs D5, D7, D11, T1, T7, T9 — resolved.

Phase 4 is complete. Phase 5 is the next executable phase; it builds the admin quotation editor on the persisted quotation API.

### Phase 4 decisions

- **D3:** Included services have no automatic monetary value; additions and deductions are entered manually.
- **D6:** Quote acceptance does not confirm a booking or reserve a date.
- **D8:** Amounts are manual, quote expiry is disabled, and revision requests have no automatic limit.
- **T3:** Versions are monotonic per booking and all versions are retained.
- **T4/T10:** Items use positive PHP `amountMinor`, explicit `add`/`deduct` direction, a kind, description, order, and optional service/customization links. Total is base plus additions minus deductions.
- **T6:** States are `draft`, `sent`, `accepted`, and `superseded`; only the latest sent quote can be accepted.

---

## 4. Plan and document deltas

| Document | Change |
| --- | --- |
| `README.md` | Added the arrangement, customization request, queue, audit, and revised conversation-lifetime behavior; added the Phase 3 migration and test command. |
| `plan.md` | Phase 3 marked complete with its implementation and verification note. |
| `reference.md` | Resolved decision rows point here instead of showing stale defaults; Phase 3 evidence added. |

Phase 1 still updates the README catalogs row when inclusions actually land; do not claim them before then.

---

## 5. Evidence

- Package/schema/service facts: `reference.md` §2.1–§2.5.
- Intake fields and null venue: `apps/api/src/controllers/booking-requests/schemas.ts`; `apps/api/src/services/booking-requests/booking-requests.ts:20`.
- Guest count absent from UI: `apps/web/src/components/app/BookingRequest.tsx:12`, `:75`.
- Venue limit: `packages/contracts/src/limits/booking-requests.ts:5`.
- Archive/delete behavior: `apps/api/src/services/services/delete-service.ts`; `apps/api/src/services/services/archive-service.ts`.
- Arrangement shape and rules: `apps/api/prisma/migrations/20261107120000_booking_arrangements_and_customization_requests/migration.sql`; `apps/api/src/services/booking-requests/arrangements.ts`.
- Customization records and decisions: `apps/api/src/controllers/customization-requests/`; `apps/api/src/services/customization-requests/customization-requests.ts`.
- Audit table and writes: `apps/api/src/data/audit/audit-events.ts`; `apps/api/src/services/booking-requests/arrangements.ts`; `apps/api/src/services/customization-requests/customization-requests.ts`.
- Conversation lifetime: `apps/api/src/utils/conversation-expiry.ts`; `apps/api/src/data/messages/expire-conversations.ts`; `apps/api/tests/messages.test.ts`.
- Phase 3 verification: `apps/api/tests/customization-requests.test.ts`; `apps/api/package.json`.
- Scope: `README.md` product scope and later work.
