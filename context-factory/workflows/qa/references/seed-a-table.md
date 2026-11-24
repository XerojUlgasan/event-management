# Seed one table

Use this when the task adds seeded rows for one database table. [Database seed](../../../../docs/SEED.md) records what `pnpm db:seed` already inserts. This skill is the procedure for adding a table to that command.

`apps/api/src/db/seed.ts` opens one transaction. It inserts the required fixtures, then calls `seedScenario`. Add the new rows inside that transaction. A module receives the parent rows it needs and returns the rows it created, including their ids.

## 1. Choose the layer

Required account fixtures and `demo.*` conversations are in `seed.ts` and `seed-demo.ts`. The catalog is planned in `seed/scenario/catalog.ts` and uses the two curated collection modules. Add a named account fixture when a current test or the [QA account table](accounts.md) depends on that email or ID.

Everything else belongs in `apps/api/src/db/seed/scenario/`. `scenario/index.ts` is the orchestrator. Its current order is users, sessions, catalog, activity, operations, then quotations. Check the current schema before assuming a table exists or is seeded. Quotations and their delivery/audit records are seeded by `scenario/quotations.ts`. Read the orchestrator before assuming a table already has rows.

Done when you can name the file that will insert the table and the parent rows that file must receive.

## 2. Read the rules that can reject the row

Read the model in `apps/api/prisma/schema.prisma`, then the migrations that still apply to that table. Keep a constraint that a later migration did not drop. Prisma omits some checks and partial unique indexes, so the SQL is the insert rule.

Also read the service that creates the same row. Copy its allowed status, role, and calculation. A row the database accepts can still be illegal for the API. Examples already used by the scenario: a booking customer is a customer; a booking package is published; `out_of_range` follows the guest count and package maximum; a message `sender_role` is `customer` or `admin` and matches that sender.

For `booking_requests` and `events_day`, keep every date inside the 30 days before and the 30 days after `seedClock()`, and make the set reach both edges.

Done when you can name the parent tables, the allowed values, and one combination you will not insert.

## 3. Plan the rows, then insert the missing ids

Follow `scenario/users.ts`.

1. Plan every row before inserting. Use `SCENARIO_COUNT` unless the task names another count. Call `expectCount` for that plan.
2. Give each row `scenarioId("table:parent:index")`. The id stays stable across runs. Put a new key namespace in the string so it does not collide with an existing key.
3. Insert with `insertIfNew`. It conflicts on `id` and leaves the stored row unchanged. Return the planned rows even when the insert inserted nothing, so the next module can reuse the ids.
4. Pass `seedClock()` into new timestamps. Read `SEED_RANDOM_SEED` through `seedRandom` only to shuffle a fixed set of legal values. A new seed must not change the count.
5. Reuse `LOCAL_PASSWORD` by accepting the hash `seed.ts` already computed. Reuse `catalogSlug` and `hashSessionToken` when the table uses those values.
6. If the table's unique key is not `id`, make that natural key stable too. A new id with an existing `(booking_request_id, version)` fails the second run. `events_day.day` is a date: pass `sql\`${day}::date\`` in that insert. `insertIfNew` cannot express that cast.

Wire the function into `seedScenario` after every parent it reads and before every child that needs its ids.

Done when a missing parent stops the seed with a clear error, and a present parent produces the planned ids.

## 4. Keep a second run from rewriting rows

The seed inserts missing ids. It does not update email, price, status, archive time, password, or session hash. A scenario session token is random on each attempt; the stored hash remains the first one because the id already exists. Login uses the shared fixture password. The stored session hash is not a cookie.

Done when you can point to the `onConflict` path and to the test assertion that an edited fixture survives a second seed.

## 5. Prove the new rows

Extend `apps/api/tests/seed.test.ts`. The test creates a disposable database, applies migrations, and runs `pnpm db:seed` twice with `SEED_CLOCK=2026-10-31T00:00:00Z`.

Add three checks:

- The new table has the planned count for its stable key, such as `reference LIKE 'SCN-%'` or the scenario email pattern.
- One query would return a row if a parent, status, or check were wrong.
- The table is in the id snapshot that the second seed must leave unchanged.

Run:

```sh
pnpm --filter @event-management/api exec tsx --test tests/seed.test.ts
```

Update [database seed](../../../../docs/SEED.md) when the inserted coverage changes. Update the QA account table when a new login is part of the fixture. Leave `seed-admin.ts` unchanged; that command creates a Firebase administrator.

Done when the seed test passes and the seed guide matches the rows the command inserts.

Run the seed only against a database whose contents may change. The command does not truncate. Existing scenario ids stay on their old values until that database is empty or those ids are removed.
