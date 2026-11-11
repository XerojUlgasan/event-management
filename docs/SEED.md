# Database seed

After applying the API migrations to a local database, run:

```sh
pnpm db:seed
```

The command runs `apps/api/src/db/seed.ts` in one PostgreSQL transaction. It does not reset or truncate the database, create Firebase users, send outbound messages, or call payment or quote services.

## What it inserts

- **Local account fixtures:** the legacy `admin1@gmail.com` account and `user1@gmail.com`–`user5@gmail.com`, plus up to 10 `staffN@example.test` and 10 `customerN@example.test` accounts. Newly inserted local accounts use the password defined in the seed source; credentials are not repeated here.
- **Package samples:** three directly published packages with a catalog page, one section, a sample photo widget, and a Markdown widget each:
  - The Grand Celebration — ₱185,000; maximum 150 guests.
  - The Intimate Gathering — ₱68,000; maximum 50 guests.
  - The Sweet Soirée — ₱95,000; maximum 80 guests.

  These are synthetic demonstration records, not business-approved prices or content. Their photo widgets reference checked-in sample images; the seed does not upload files to Supabase Storage.
- **Venue samples:** 15 legacy synthetic venue samples are created as archived rows with null capacity. Three demo venues are inserted directly as published records, with valid capacity/content and no photos. The published demos have descriptions that say availability has not been checked.
- **Connected demo conversations:** one demo administrator and five customers under `demo.*@clemora.example.test`, with one general conversation and two messages per customer.
- **Interconnected scenario:** 100 additional rows in each of the original 16 scenario tables, plus 100 quotations and their delivery/audit records. Package-service links remain unseeded. Accounts are `scenario.user001@clemora.example.test` through `scenario.user100@clemora.example.test` and use the same local fixture password as the accounts above. `user001`–`user004` are System Administrators, `user005`–`user028` are staff, and `user029`–`user100` are customers. Staff titles cycle through the existing staff titles, starting with Event Coordinator.

  The scenario links those accounts to catalog rows, booking requests, conversations, messages, sessions, event days, availability responses, and staff assignments. References use `SCN-001` through `SCN-100`. Status, archive, guest-count, and staffing values vary across the legal combinations: 80 packages stay public and 20 are archived; 70 venues stay public; 60 services stay public with an hourly rate and a photo; the remaining services and some venues are archived, including null legacy rates and capacities. Requested dates, preferred dates, and event days stay inside the 30 days before and the 30 days after the seed clock, and the set reaches both edges. A clock of 30 October therefore fills 30 September through 29 November. Forty accepted requests own the 100 event days. Confirmed assignments exist only on scheduled days whose staffing is closed, and only for staff who responded available. A moved day points at a scheduled replacement on the same request. Declined and cancelled requests have no operational days.

  Sample photos use the four checked-in image paths. Five archived venue pages reference video metadata and do not upload video bytes. Twenty sample images are not attached to a widget. Scenario sessions mix current and expired rows; the raw session tokens are not stored or printed. The scenario does not create payments, package-to-service assignments, or Firebase users.

- **Quotations:** `seed/scenario/quotations.ts` adds two PHP versions to 50 scenario bookings: 50 superseded first offers, followed by 17 drafts, 17 sent offers, and 16 accepted offers. Twenty-six versions are base-only; the others include a ₱2,500.50 addition and a ₱500.25 deduction. Base prices come from the stored current proposal and totals use the API's integer-centavo calculation. Each revision points to its superseded predecessor. Draft revisions require adjustment review. These are synthetic offers, not approved business prices.

  The 83 sent versions have exact-version messages in their booking conversation. The 269 audit events record creation, adjustment saves, revisions, sending, and customer acceptance with the appropriate actor. These are additional rows beyond the original 100 scenario messages. Initial selection requires 50 customer bookings with an active conversation that has not expired at `SEED_CLOCK`; closed requests are excluded. The module reads stored parents rather than replanning their statuses. An older scenario with expired conversations needs its original seed clock or a disposable database; the seed does not reopen conversations. Quotations do not change booking statuses or create event days.

The seeded packages, services, and venues remain flat catalog records without service assignments or private custom packages. Each catalog page has one package, service, or venue owner. The three named package samples and the published demo venues are unchanged by the scenario.

## Repeat runs and collisions

Reference package, venue, connected demo, and scenario IDs are stable. Catalog and scenario rows are insert-only and do not overwrite existing edits, archives, passwords, or sessions. A package sample's page, section, sample media row, and widgets are created only when the seed inserts that package row. Scenario children use their own stable IDs, so a later run fills a missing child without changing a parent that already exists. Existing records with a reserved ID or email are preserved; a collision can leave the corresponding sample or dependent content incomplete. Inspect the target if a fixture is missing; do not use the seed to reconcile collisions or clean shared data.

The demo conversation, published demo venue, and scenario IDs are derived from stable keys. Existing catalog rows are not upgraded or republished on rerun. The 15 legacy synthetic venue samples are archived; they are not private drafts. A second run does not rotate scenario session token hashes. Quotation IDs and `(booking_request_id, version)` keys stay stable. Previously selected bookings remain selected after later closure. Existing quotations and their lifecycle records are preserved; delivery/audit records are inserted only with a newly inserted quotation. The seed does not reconstruct deleted delivery/audit history for an existing quotation.

`SEED_CLOCK` optionally fixes connected demo and scenario timestamps. Supply a UTC timestamp such as `2026-10-31T00:00:00Z`; when it is omitted, current time is used. Existing rows are not retimestamped on rerun. Sample package timestamps use database defaults and are not controlled by `SEED_CLOCK`. `SEED_RANDOM_SEED` changes which scenario request receives each status. The status counts stay the same, and a new seed value does not rewrite rows inserted earlier.

## Package-canvas migration impact

Migration `20261102130000_package_canvas` intentionally removes existing package data, package version history and service assignments, booking requests and status history, and conversations/messages linked to booking requests. General conversations and their messages remain. This migration runs before seeding on an existing database; the seed itself does not perform this cleanup. Review and back up relevant data before applying the migration to a database that contains records.

## Verify with a disposable database

The focused integration test creates a UUID-named local PostgreSQL database, applies checked-in migrations, runs the seed twice, checks the required fixtures, the 100-row scenario, quotation totals/revisions/delivery/audits, customer draft visibility, public API reads, and rerun preservation after price edits and booking closure, and drops only that test database:

```sh
pnpm --filter @event-management/api exec tsx --test tests/seed.test.ts
```

For manual verification, create a separate local database, apply migrations, and point each seed command at it:

```sh
DB_NAME=clemora_seed_check pnpm db:deploy
DB_NAME=clemora_seed_check SEED_CLOCK=2026-10-31T00:00:00Z pnpm db:seed
DB_NAME=clemora_seed_check SEED_CLOCK=2026-10-31T00:00:00Z pnpm db:seed
```

Use the read-only `context-factory/QA/scripts/pg-query.mjs` helper with `DB_NAME` pointed at the disposable database if SQL inspection is useful. Remove only the disposable database when finished; never point this procedure at a shared or production database.
