# API verification

- `pnpm --filter @event-management/api check` runs TypeScript without emitting files; `pnpm db:validate` checks Prisma schema configuration.
- The closest behavior suite for auth is `pnpm --filter @event-management/api test:auth`. Its source is `apps/api/tests/auth.test.ts`: it runs route requests against a disposable local PostgreSQL database and Firebase Auth emulator. It requires Firebase CLI on `PATH`, local PostgreSQL, and permission to create a test database. Read the setup and teardown before changing it or running it with unusual database settings.
- Keep new assertions about observable route behavior: status, body, cookie/session result, database result, and OpenAPI contract where relevant. Extend the existing suite for auth changes. For a new feature area, add a focused behavioral test matching its actual dependencies.
- A type check does not establish that a route works with PostgreSQL, the emulator, or a browser. Report which boundaries were actually exercised.
