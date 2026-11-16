# Database seed

After applying the API migrations to a local database, run:

```sh
pnpm db:seed
```

The command runs `apps/api/src/db/seed.ts` in one PostgreSQL transaction. It does not reset or truncate the database, create Firebase users, send outbound messages, or call payment or quote services.

## What it inserts

- **Local account fixtures:** the designated `admin1@gmail.com` System Administrator account and `user1@gmail.com`–`user5@gmail.com`, plus up to 10 `customerN@example.test` accounts. Newly inserted local accounts use the password defined in the seed source; credentials are not repeated here.
- **Package samples:** three directly published packages, each with a canvas containing one section, a sample photo widget, and a Markdown widget:
  - The Grand Celebration — ₱185,000; maximum 150 guests.
  - The Intimate Gathering — ₱68,000; maximum 50 guests.
  - The Sweet Soirée — ₱95,000; maximum 80 guests.

  These are synthetic demonstration records, not business-approved prices or content. Their photo widgets reference checked-in sample images; the seed does not upload files to Supabase Storage.
- **Connected demo conversations:** one demo administrator and five customers under `demo.*@clemora.example.test`, with one general conversation and two messages per customer.
- **Interconnected scenario:** 100 users, sessions, packages, services, booking requests, status-history rows, linked conversations, messages, and event days, plus 100 quotations and their delivery/audit records. The scenario initializes 80 owner canvases: 60 on services and 20 on packages. Package-service links remain unseeded. Accounts are `scenario.user001@clemora.example.test` through `scenario.user100@clemora.example.test` and use the same local fixture password as the accounts above. `user001`–`user004` are System Administrators; `user005`–`user100` are customers.

  The scenario links those accounts to catalog rows, booking requests, conversations, messages, sessions, and event days. References use `SCN-001` through `SCN-100`. Status, archive, and guest-count values vary across legal combinations: 80 packages stay public and 20 are archived; 60 services stay public and 40 are archived. Requested dates, preferred dates, and operational event days stay inside the 30 days before and the 30 days after the seed clock, and the set reaches both edges. A clock of 30 October therefore fills 30 September through 29 November. Forty accepted requests own the 100 event days. Moved days point to scheduled replacements on the same request. Declined and cancelled requests have no operational days.

  Scenario media includes 60 attached service photos and 20 unreferenced sample images. Sample photos use the four checked-in image paths. Scenario sessions mix current and expired rows; the raw session tokens are not stored or printed. The scenario does not create payments, package-to-service assignments, or Firebase users.

- **Quotations:** `seed/scenario/quotations.ts` adds two PHP versions to 50 scenario bookings: 50 superseded first offers, followed by 17 drafts and 33 sent offers. New fixtures do not create accepted quotations; customers respond through chat. Twenty-six versions are base-only; the others include a ₱2,500.50 addition and a ₱500.25 deduction. Base prices come from the stored current proposal and totals use the API's integer-centavo calculation. Each revision points to its superseded predecessor. Draft revisions require adjustment review. These are synthetic offers, not approved business prices.

  The 83 sent versions have exact-version messages in their booking conversation. The 253 audit events record admin creation, adjustment saves, revisions, and sending. These are additional rows beyond the original 100 scenario messages. Initial selection requires 50 customer bookings with an active conversation; closed requests are excluded. Conversation age and event end times do not affect selection. The module reads stored parents rather than replanning their statuses and does not reopen closed conversations. Quotations do not change booking statuses or create event days.

The seeded packages and services remain flat catalog records without package-service assignments or private custom packages. Each owner stores its canvas as JSONB; `package_services` remains a separate relational link. The three named package samples are unchanged by the scenario. No venue-catalog or staff-account fixtures are created.

## Repeat runs and collisions

Reference package, connected demo, and scenario IDs are stable. Catalog and scenario rows are insert-only and do not overwrite existing edits, archives, passwords, or sessions. A package sample's sample media row and canvas are created only when the seed inserts that package row. Scenario package/service canvases are initialized only when the seed inserts their owner. A later run preserves an existing owner's edits, including an intentionally empty canvas; it does not fill missing sections or widgets inside that canvas. Other scenario child records continue to use stable IDs and their seed-specific insert-if-new rules. Existing records with a reserved ID or email are preserved; a collision can leave the corresponding sample or dependent content incomplete. Inspect the target if a fixture is missing; do not use the seed to reconcile collisions or clean shared data.

The demo conversation and scenario IDs are derived from stable keys. Existing catalog rows are not upgraded or republished on rerun. A second run does not rotate scenario session token hashes. Quotation IDs and `(booking_request_id, version)` keys stay stable. Previously selected bookings remain selected after later closure. Existing quotations and their lifecycle records, including historical accepted offers, are preserved; delivery/audit records are inserted only with a newly inserted quotation. The seed does not reconstruct deleted delivery/audit history for an existing quotation. Fresh-seed counts above do not describe an older database that retains accepted fixtures.

`SEED_CLOCK` optionally fixes connected demo and scenario timestamps. Supply a UTC timestamp such as `2026-10-31T00:00:00Z`; when it is omitted, current time is used. Existing rows are not retimestamped on rerun. Sample package timestamps use database defaults and are not controlled by `SEED_CLOCK`. `SEED_RANDOM_SEED` changes which scenario request receives each status. The status counts stay the same, and a new seed value does not rewrite rows inserted earlier.

## Catalog and account cleanup migration impact

Migration `20261114151517_complete_catalog_staff_removal` removes the obsolete staff role and staff tables, converts former staff and undesignated administrators to customers, revokes sessions for converted accounts, and keeps only designated System Administrators as administrators. At that stage it removes venue-catalog records and their pages while preserving pages owned by packages or services, plus shared media. It also drops coordinator and checklist-delivery metadata. Migration `20261116072801_embed_catalog_canvas` later embeds the remaining canvases in their package/service owners and drops the page/section/widget tables. Follow-up migration `20261114154206_remove_event_checklists` drops the event-checklist table and content validator, removing saved task definitions and progress. Historical migration files remain unchanged as evidence of the earlier schema.

After applying the migration, use the existing stale-media cleanup command if unreferenced storage objects should be removed:

```sh
pnpm --filter @event-management/api media:cleanup
```

The cleanup command removes stale media only; it is separate from the migration and should be run against the intended storage environment.

## Entity-owned catalog canvas migration impact

Migration `20261116072801_embed_catalog_canvas` adds `packages.canvas` and `services.canvas`, backfills each owner's sections and widgets in display order while preserving section/widget IDs, fields, and media IDs, then drops `catalog_widgets`, `catalog_sections`, and `catalog_pages`. It leaves package/service owner timestamps, `media_assets`, uploaded Storage objects, and relational `package_services` links unchanged. Apply it with the matching API; the [database guidance](../context-factory/areas/api/references/database-and-migrations.md) describes the new storage contract.

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

Use the read-only `context-factory/tools/qa/pg-query.mjs` helper with `DB_NAME` pointed at the disposable database if SQL inspection is useful. Remove only the disposable database when finished; never point this procedure at a shared or production database.
