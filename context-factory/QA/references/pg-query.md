# PostgreSQL queries

## Connection and execution

The helper loads `apps/api/.env` without printing its values and uses the API's installed `pg` driver. Shell environment variables take precedence, as in the API. Connection variables are `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`; defaults for host and port match `apps/api/src/db/config.ts`.

```sh
node context-factory/QA/scripts/pg-query.mjs 'SELECT current_database() AS database, current_user AS db_role'
```

SQL is the first argument; optional bound parameters are a JSON array in the second. Keep SQL inside single shell quotes so `$1` is passed to PostgreSQL. For multiline SQL, use quoted standard input:

```sh
node context-factory/QA/scripts/pg-query.mjs - '["user1@gmail.com"]' <<'SQL'
SELECT id, email, display_name, role
FROM users
WHERE lower(trim(email)) = $1;
SQL
```

The helper executes one statement through PostgreSQL's extended protocol inside `BEGIN READ ONLY`, then rolls back. It sets a 10-second statement timeout and a 5-second connection timeout. Writes and multiple statements are rejected. This is a transaction boundary, not a sandbox for untrusted SQL functions or external side effects. Use task-appropriate SQL and inspect functions before invoking them.

For task-authorized data changes, use the existing API/Kysely workflow; schema changes belong in Prisma migrations. The [QA operational permissions](../SKILL.md#operational-permissions) allow scripts, deployments, migrations, and service startup/restarts, but this query helper remains read-only. Do not add a generic write bypass just to run an inspection query.

## Discover current tables and columns

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = $1
ORDER BY ordinal_position;
```

Bind `["users"]` or `["sessions"]` for the second query. Read `apps/api/prisma/schema.prisma`, relevant migrations, and generated `apps/api/src/db/types.ts` when more detail matters. Constraints in SQL migrations can go beyond the Prisma model.

## Inspect account setup without exposing password hashes

```sql
SELECT id, email, display_name, role,
       password_hash IS NOT NULL AS has_password,
       firebase_uid IS NOT NULL AS has_firebase
FROM users
WHERE lower(trim(email)) = $1;
```

Bind `["admin1@gmail.com"]` or another fixture email. This proves stored account setup; successful login must still be checked through the API/browser.

## Inspect an account's active sessions

```sql
SELECT s.id AS session_id, u.email, u.role, s.created_at, s.expires_at,
       length(s.token_hash) AS stored_hash_length
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE lower(trim(u.email)) = $1 AND s.expires_at > now()
ORDER BY s.created_at DESC;
```

The stored hash length should be 64 hexadecimal characters. No active rows means no current session, not necessarily a broken account. Logging in creates a session; logout deletes it, and seeding preserves existing fixture sessions.

If inspecting the stored value is specifically relevant, select `s.token_hash` instead of its length. It remains a hash, not a usable login token. For a usable token, run `scripts/session.mjs` from the parent skill and use its temporary cookie-header file. There is no SQL query that reverses the hash.

To correlate one known session token with its exact stored row, hash that cookie token with the same `hashSessionToken` implementation in `apps/api/src/utils/session.ts`, then bind the resulting SHA-256 hex string:

```sql
SELECT s.id AS session_id, u.email, u.role, s.created_at, s.expires_at
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1;
```

Keep runtime token/hash values out of chat, shell history, and checked-in artifacts. Avoid `SELECT *` on auth tables when explicit safe columns answer the question. SQL access checks DB permissions; the `em_session` cookie checks API permissions. They serve different purposes.
