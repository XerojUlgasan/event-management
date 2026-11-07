# API verification

- `pnpm --filter @event-management/api check` runs TypeScript without emitting files; `pnpm db:validate` checks Prisma schema configuration.
- The closest behavior suite for auth is `pnpm --filter @event-management/api test:auth`. Its source is `apps/api/tests/auth.test.ts`: it runs route requests against a disposable local PostgreSQL database and Firebase Auth emulator. It requires Firebase CLI on `PATH`, local PostgreSQL, and permission to create a test database. Read the setup and teardown before changing it or running it with unusual database settings.
- Keep new assertions about observable route behavior: status, body, cookie/session result, database result, and OpenAPI contract where relevant. Extend the existing suite for auth changes. For a new feature area, add a focused behavioral test matching its actual dependencies.
- `pnpm --filter @event-management/api test:packages`, `test:booking-requests`, `test:customization-requests`, `test:messages`, and `exec tsx --test tests/seed.test.ts` create UUID-named disposable local PostgreSQL databases, apply migrations, and drop only those test databases. The package suite uses a local fake S3-compatible server for media storage paths; it does not verify a configured Cloudflare R2 account. Read test setup and teardown before running these suites.
- A type check does not establish that a route works with PostgreSQL, the emulator, or a browser. Report which boundaries were actually exercised.

- `pnpm --filter @event-management/api exec tsx --test tests/flat-catalog-migration.test.ts` applies migrations to a disposable database and checks published-content selection, draft-only archives, selected canvas/media retention, owner constraints, and removal of service/venue version tables.

- `pnpm --filter @event-management/api exec tsx --test tests/catalog-cleanup-migration.test.ts` proves the catalog-field cleanup preserves retained records, guest limits, snapshots, messages, and canvas media while removing obsolete columns.
