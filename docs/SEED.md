# Database seed

After applying the API migrations to a local database, run the workspace command:

```sh
pnpm db:seed
```

It runs `apps/api/src/db/seed.ts` in one PostgreSQL transaction. It does not reset or truncate the database. The script writes PostgreSQL rows only; it does not create Firebase users, send outbound messages, or call payment or quote services.

## What it inserts

The schema has no mandatory lookup tables. The seed supplies catalog and account fixtures for development:

- **Existing fixtures:** the legacy `admin1@gmail.com` and `user1@gmail.com`–`user5@gmail.com` accounts, up to 10 `staffN@example.test` and 10 `customerN@example.test` accounts, three sample package drafts, and 15 synthetic venue drafts. These samples are not approved offers or real venues. The three legacy package drafts have fixed sample totals, but remain private drafts until an administrator publishes them.
- **Connected demo records:** one administrator and five customers under `demo.*@clemora.example.test`; four published demo services; three published demo package versions; three published demo venues without photos; package-to-service assignments; ten booking requests with status-history rows; and one conversation with two messages for each demo customer. Five requests use named scenarios and five use seeded pseudo-random choices. The published offers are still demo data, not business-approved prices or terms. All newly inserted local users use the password set in the seed source; credentials are not printed by this document.

The connected records are built in dependency order: users, service and package parents with version rows, and venue parents with published versions. Assignments link published package versions to published service versions. Booking requests link a demo customer to a published package and its version; their history rows link the request and the customer or demo administrator who changed its status. Conversations link each demo customer to their messages, including an administrator reply. Venue catalog rows are independent of package and booking foreign keys; booking requests use a preferred-location text snapshot. If a required user, published version, or relationship is unavailable, dependent demo rows can be skipped.

The 15 older synthetic venues remain private drafts without capacity values or photos. The three connected demo venues have sample maximum capacity values and publish without photos. An untouched draft from the earlier demo seed is published on rerun; edited or archived venues remain unchanged. The seed creates no quote or payment tables or records.

## Repeat runs and stable data

Seed-owned reference package and venue IDs are fixed. Connected demo row IDs are derived from fixed keys. Email addresses, IDs, package/service versions, request references, and other relationship keys make reruns insert-only: existing records and admin edits are not generally refreshed or deleted, and existing sessions are not changed. Narrow compatibility cases upgrade a version-one package only when it exactly matches the old incomplete draft placeholder, and publish a demo venue version only when it exactly matches the earlier untouched photo-free draft. Other edits and archives are preserved.

If an account address, reserved ID, or unique request reference already belongs to another row, conflict handling skips that insert. Since dependent rows require the expected seed records, an ID collision can also leave some demo content missing or attached to an existing row with that reserved ID. A collision may make a fixture login unavailable. Do not use the seed to reconcile collisions or clean a shared database; inspect the target first.

`SEED_RANDOM_SEED` controls the pseudo-random choices of eligible published packages and customers for five requests, plus guest counts, dates, preferred locations, and request details. Its default is `clemora-demo-v1`. `SEED_CLOCK` optionally fixes the connected demo timestamps and relative event dates; provide a valid UTC timestamp such as `2026-10-31T00:00:00Z`. When omitted, the current time is used. The same values produce the same choices and timestamps on an empty database, but reruns do not replace existing rows or reset timestamps. The legacy fixtures use database defaults for timestamps and are not controlled by `SEED_CLOCK`.

## Verify with a disposable database

The focused integration test creates and drops its own local PostgreSQL database, applies checked-in migrations, runs the seed twice, and checks relationships, rerun preservation, and API reads:

```sh
pnpm --filter @event-management/api exec tsx --test tests/seed.test.ts
```

For manual inspection, create a separate local PostgreSQL database, set `DB_NAME` to its name for each command, and apply migrations before seeding. For example:

```sh
DB_NAME=clemora_seed_check pnpm db:deploy
DB_NAME=clemora_seed_check SEED_RANDOM_SEED=seed-check SEED_CLOCK=2026-10-31T00:00:00Z pnpm db:seed
DB_NAME=clemora_seed_check SEED_RANDOM_SEED=seed-check SEED_CLOCK=2026-10-31T00:00:00Z pnpm db:seed
```

Inspect safe row counts and foreign-key relationships after the first run, then confirm the second run adds no duplicate seed records and preserves edits to existing rows. Use the read-only `context-factory/QA/scripts/pg-query.mjs` helper with `DB_NAME` pointed at the disposable database if SQL inspection is useful. Remove only the disposable database when finished. Never point this procedure at a shared or production database.
