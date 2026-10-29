---
name: qa
description: Test Clemora accounts and authenticated API behavior using seeded admin/customer logins, obtain session cookies, and inspect the local PostgreSQL database with custom read-only SQL queries.
---

# QA

Use this skill for account-based QA, API sessions, or local database inspection in this repository. Commands below run from the repository root; helpers resolve `apps/api/.env` and dependencies relative to their own location.

## Test accounts

These are the development fixtures from `apps/api/src/db/seed.ts`, not Firebase accounts. Use the normal email/password login, leaving **Use my existing Firebase email account** unchecked.

| Email | Display name | Role | Staff role | Password |
| --- | --- | --- | --- | --- |
| admin@clemora.com | System Admin | admin | System Administrator | p@ssword01 |
| marcos.reyes@clemora.com | Marcos Reyes | admin | Event Coordinator | p@ssword01 |
| isabelle.santos@clemora.com | Isabelle Santos | admin | Event Coordinator | p@ssword01 |
| daniel.cruz@clemora.com | Daniel Cruz | admin | Head Waiter | p@ssword01 |
| patricia.lim@clemora.com | Patricia Lim | admin | Waiter | p@ssword01 |
| jose.torres@clemora.com | Jose Torres | admin | Waiter | p@ssword01 |
| angela.rivera@clemora.com | Angela Rivera | admin | Waiter | p@ssword01 |
| rafael.mendoza@clemora.com | Rafael Mendoza | admin | Graphic Designer | p@ssword01 |
| clara.navarro@clemora.com | Clara Navarro | admin | Photographer | p@ssword01 |
| miguel.bautista@clemora.com | Miguel Bautista | admin | Host | p@ssword01 |
| diana.flores@clemora.com | Diana Flores | admin | Catering Supervisor | p@ssword01 |
| james.ochoa@gmail.com | James Ochoa | customer | — | p@ssword01 |
| sophia.reyes@gmail.com | Sophia Reyes | customer | — | p@ssword01 |
| nathan.garcia@gmail.com | Nathan Garcia | customer | — | p@ssword01 |
| emily.dela.cruz@gmail.com | Emily Dela Cruz | customer | — | p@ssword01 |
| aaron.villanueva@gmail.com | Aaron Villanueva | customer | — | p@ssword01 |
| mia.santos@gmail.com | Mia Santos | customer | — | p@ssword01 |
| carlos.ramos@gmail.com | Carlos Ramos | customer | — | p@ssword01 |
| grace.aquino@gmail.com | Grace Aquino | customer | — | p@ssword01 |
| luis.fernandez@gmail.com | Luis Fernandez | customer | — | p@ssword01 |
| jasmine.catalan@gmail.com | Jasmine Catalan | customer | — | p@ssword01 |

`pnpm db:seed` creates/resets these 21 accounts, including names, roles, passwords, and previous sessions. Run it when fixture setup/reset is within the task; it can invalidate another agent's test session. First inspect existing fixtures if they may already be usable. New local passwords have an 8-character minimum.

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

For QA results, distinguish browser checks, API responses, and direct database evidence. Package catalog reads and admin edits use PostgreSQL through `/v1/packages`; booking requests use `/v1/booking-requests` and their customer/manager views. Confirmed bookings, quotes, payments, and event delivery remain separate future workflows or demos. Trace each workflow's actual API/persistence before claiming it is end to end. If the API or database is unavailable, report that boundary; do not automatically reset fixtures or restart services. Inspect current source if these notes differ from behavior.
