---
name: qa
description: Test Clemora accounts and authenticated API behavior using seeded admin/customer logins, obtain session cookies, and inspect the local PostgreSQL database with custom read-only SQL queries.
---

# QA

Use this skill for account-based QA, API sessions, or local database inspection in this repository. Commands below run from the repository root; helpers resolve `apps/api/.env` and dependencies relative to their own location.

## Test accounts

These are the development fixtures from `apps/api/src/db/seed.ts`, not Firebase accounts. Use the normal email/password login, leaving **Use my existing Firebase email account** unchecked.

| Email | Role | Password |
| --- | --- | --- |
| admin1@gmail.com | System Administrator | p@ssword01 |
| user1@gmail.com through user5@gmail.com | customer | p@ssword01 |
| staff1@example.test through staff10@example.test | staff | p@ssword01 |
| customer1@example.test through customer10@example.test | customer | p@ssword01 |

`pnpm db:seed` inserts fixtures only when their addresses are unused; existing accounts and their sessions are never changed. A collision may therefore make a demo login unavailable. Inspect fixtures first and do not run the seed against a shared database without task authorization. New local passwords have an 8-character minimum. Staff can read booking requests and published catalog; System Administrators manage the catalog, directory, messages, and request statuses.

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
