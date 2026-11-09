---
name: qa
description: Run Clemora QA, including scripts, deployments, migrations, service startup/restarts, authenticated API checks, and read-only PostgreSQL inspection. Database resets are prohibited.
---

# QA

Use this skill for account-based QA, API sessions, or local database inspection in this repository. Commands below run from the repository root; helpers resolve `apps/api/.env` and dependencies relative to their own location.

## Operational permissions

When carrying out QA, you may run scripts, deploy, create and apply migrations, and start or restart the application and its services as needed without additional confirmation. This includes `pnpm all`, `pnpm dev:prepare`, `pnpm db:up`, `pnpm db:migrate`, and `pnpm db:deploy`. Inspect the script, current processes, selected environment, and deployment/database target before acting. Review pending migrations and follow the [database guidance](../api/reference/database-and-migrations.md), including backups for affected existing data.

Never run `pnpm db:reset`, `prisma migrate reset`, or equivalent database-reset commands, directly or through another script. Decline reset prompts from migration tools; investigate drift or migration failures without resetting the database. This prohibition applies even to disposable databases.

## Test accounts

These are the development fixtures from `apps/api/src/db/seed.ts`, not Firebase accounts. Use the normal email/password login, leaving **Use my existing Firebase email account** unchecked.

| Email | Role | Password |
| --- | --- | --- |
| admin1@gmail.com | System Administrator | p@ssword01 |
| user1@gmail.com through user5@gmail.com | customer | p@ssword01 |
| staff1@example.test through staff10@example.test | staff | p@ssword01 |
| customer1@example.test through customer10@example.test | customer | p@ssword01 |
| demo.admin@clemora.example.test | System Administrator | p@ssword01 |
| demo.ana@clemora.example.test | customer | p@ssword01 |
| demo.ben@clemora.example.test | customer | p@ssword01 |
| demo.camille@clemora.example.test | customer | p@ssword01 |
| demo.daniel@clemora.example.test | customer | p@ssword01 |
| demo.ella@clemora.example.test | customer | p@ssword01 |

`pnpm db:seed` preserves existing accounts and sessions and inserts missing development fixtures. It includes three directly published package samples with sample-photo and Markdown canvas content, demo users, general conversations, 15 archived legacy venue samples with null capacity, and three directly published photo-free demo venues. The sample package names and prices are demonstration data, not approved offers. The seed does not create services, package-service assignments, or booking inquiries. Catalog rows are insert-only; rerunning the seed does not upgrade or republish existing catalog records. A collision may make a demo login or related records unavailable. See [database seed](../../docs/SEED.md) for coverage, rerun behavior, migration impact, and disposable verification. Inspect fixtures first and do not run the seed against a shared database without task authorization. New local passwords have an 8-character minimum. The `20261102130000_package_canvas` migration removes old package records, package versions and service assignments, booking requests/status history, and booking-linked conversations/messages; general conversations and messages are preserved. Staff can read booking requests and published catalog; System Administrators manage the catalog, directory, messages, and request statuses. Catalog packages, services, and venues save directly as flat public active records; booking-owned custom packages are private and use booking-scoped reads and writes with booking and package versions. Catalog updates use `expectedUpdatedAt`, and archives hide catalog records. Venues remain a standalone catalog and do not establish availability or reservations. The booking-request preferred location remains independent.

## Session cookies for API tests

```sh
node context-factory/QA/scripts/session.mjs admin1@gmail.com
```

The helper logs in through `/v1/auth/login`, checks `/v1/me`, and prints the account identity, API URL, and path to a private temporary cookie-header file. It uses `API_PORT` from the API environment (default 3000). An optional second argument overrides the full local API base URL, including `/v1`.

Use the returned file without printing its contents:

```sh
curl --fail-with-body --header @/tmp/clemora-qa-EXAMPLE/cookie-header http://localhost:3000/v1/me
```

Replace the example path and URL with the helper's output. Reuse that header for custom API requests. When finished, `POST` to the same base URL's `/auth/logout` with the header, then remove the generated temporary directory. A session cookie is sent as `Cookie: em_session=...`, not a Firebase bearer token.

**SQL cannot recover a usable session token.** `sessions.token_hash` contains SHA-256 of the cookie token, not the token itself. Use login to obtain a real cookie; never weaken storage or treat the stored hash as a cookie. Do not paste runtime tokens, cookie files, password hashes, database credentials, or service-account contents into chat or checked-in artifacts. The fixture credentials above are intentionally documented development data.

## pg-query

Read [PostgreSQL queries](references/pg-query.md) for schema discovery, account/session SQL, parameter binding, and the helper's limits.

```sh
node context-factory/QA/scripts/pg-query.mjs \
  'SELECT id, email, display_name, role FROM users WHERE lower(trim(email)) = $1' \
  '["user1@gmail.com"]'
```

The helper uses the configured database credentials in a read-only transaction, limits statement execution time, and accepts one SQL statement. Database access uses the DB role; it does not impersonate the test account. Use authenticated API requests when testing application permissions.

For QA results, distinguish browser checks, API responses, direct database evidence, and external storage behavior. Public catalog reads use `/v1/packages`, `/v1/services`, and `/v1/venues`; admin create/update/archive operations use `/v1/admin/{packages,services,venues}` and PostgreSQL. Updates replace full content and use `expectedUpdatedAt`; stale or archived updates return `409`. Service saves require a positive whole-peso hourly rate and a canvas photo; venue saves require a positive maximum guest count and allow no photos. Migrated null rates or guest limits may remain readable, while current saves enforce complete input. Uploaded package, service, and venue canvas bytes use R2 through catalog-media routes. Public streaming requires a reference from a published, non-archived entity page; admin previews may access that administrator's own pending uploads and archived-record media. Private package media requires the owning customer or a System Administrator. Source uploads are independently copied when a custom package is created. API or database evidence alone does not prove R2 availability or browser behavior. Booking requests use `/v1/booking-requests` and their customer/manager views. Confirmed bookings, payments, and event delivery remain separate future workflows or demos; quotation persistence, API behavior, and customer chat delivery are implemented. Sending a quote, accepting it, and requesting a revision should each be checked in the booking conversation, alongside the quotation state. Trace each workflow's actual API/persistence before claiming it is end to end. If the API or database is unavailable, inspect the cause and use the operational permissions above to restore the services needed for QA; report any remaining blocker without resetting the database. Inspect current source if these notes differ from behavior.

For a private-package journey, check the System Administrator's booking Overview, cancel without creating a package, save and reload a custom package, edit it again, and exercise stale and media-copy failures. Verify the owner can view it and open the linked conversation, while another customer, a signed-out visitor, and ordinary staff cannot read private package content or media. Check public catalogs and inquiry selection omit it. Verify quotation stale-basis blocking and revision with explicit adjustment review and customer reacceptance. Use test accounts and disposable fixtures; distinguish browser, API/database, fake storage, and actual R2 proof.
