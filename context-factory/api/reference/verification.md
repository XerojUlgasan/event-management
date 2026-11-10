# API verification

- `pnpm --filter @event-management/api test:event-days` exercises the staffing routes against a UUID-named disposable local PostgreSQL database. It covers role permissions, accepted requests, timezone/overnight schedules, response deadlines, separate availability/assignment records, coordinator and overlap protection, and cancellation/movement history. It does not establish browser or hosted-provider behavior.

- `pnpm --filter @event-management/api check` runs TypeScript without emitting files; `pnpm db:validate` checks Prisma schema configuration.
- The closest behavior suite for auth is `pnpm --filter @event-management/api test:auth`. Its source is `apps/api/tests/auth.test.ts`: it runs route requests against a disposable local PostgreSQL database and Firebase Auth emulator. It requires Firebase CLI on `PATH`, local PostgreSQL, and permission to create a test database. Read the setup and teardown before changing it or running it with unusual database settings.
- Keep new assertions about observable route behavior: status, body, cookie/session result, database result, and OpenAPI contract where relevant. Extend the existing suite for auth changes. For a new feature area, add a focused behavioral test matching its actual dependencies.
- `pnpm --filter @event-management/api test:packages`, `test:booking-requests`, `test:messages`, and `exec tsx --test tests/seed.test.ts` create UUID-named disposable local PostgreSQL databases, apply migrations, and drop only those test databases. The package suite uses a local fake Storage API for media paths; it does not verify a configured Supabase Storage bucket. Read test setup and teardown before running these suites.
- A type check does not establish that a route works with PostgreSQL, the emulator, or a browser. Report which boundaries were actually exercised.

- `pnpm --filter @event-management/api exec tsx --test tests/flat-catalog-migration.test.ts` applies migrations to a disposable database and checks published-content selection, draft-only archives, selected canvas/media retention, owner constraints, and removal of service/venue version tables.

- `pnpm --filter @event-management/api exec tsx --test tests/catalog-cleanup-migration.test.ts` proves the catalog-field cleanup preserves retained records, guest limits, snapshots, messages, and canvas media while removing obsolete columns.

- `pnpm --filter @event-management/api test:rls` applies migrations to a disposable local database and checks RLS coverage, retained data, server access, and removal of `PUBLIC` table grants. When `anon` and `authenticated` exist, it also proves read and `TRUNCATE` denial for both roles. Those subtests explicitly skip on ordinary Compose databases without Supabase roles; run against the local Supabase connection to cover them. The suite does not alter the configured application database or create shared roles.
