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

The seed does not create services, package-to-service assignments, booking requests, quotes, or payments. Packages, services, and venues are independent flat catalog records; each catalog entity has at most one page in the reusable page/section/widget/media tables.

## Repeat runs and collisions

Reference package, venue, and connected demo IDs are stable. Catalog seed rows are insert-only and do not overwrite existing edits or archives. A package's page, section, sample media row, and widgets are created only when the seed inserts that package row. Existing records with a reserved ID or email are preserved; a collision can leave the corresponding sample or dependent demo content incomplete. Inspect the target if a fixture is missing; do not use the seed to reconcile collisions or clean shared data.

The demo conversation and published demo venue IDs are derived from stable keys. Existing catalog rows are not upgraded or republished on rerun. The 15 legacy synthetic venue samples are archived; they are not private drafts.

`SEED_CLOCK` optionally fixes connected demo timestamps. Supply a UTC timestamp such as `2026-10-31T00:00:00Z`; when it is omitted, current time is used. Existing rows are not retimestamped on rerun. Sample package timestamps use database defaults and are not controlled by `SEED_CLOCK`.

## Package-canvas migration impact

Migration `20261102130000_package_canvas` intentionally removes existing package data, package version history and service assignments, booking requests and status history, and conversations/messages linked to booking requests. General conversations and their messages remain. This migration runs before seeding on an existing database; the seed itself does not perform this cleanup. Review and back up relevant data before applying the migration to a database that contains records.

## Verify with a disposable database

The focused integration test creates a UUID-named local PostgreSQL database, applies checked-in migrations, runs the seed twice, checks package/venue/conversation rows and public API reads, and drops only that test database:

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
