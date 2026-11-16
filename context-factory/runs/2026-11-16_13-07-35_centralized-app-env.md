# Centralized app environment configuration

Started: 2026-11-16T13:07:35+08:00
Updated: 2026-11-16T13:07:35+08:00
Status: complete
Scope: User authorized implementation after read-only investigation; centralize app environment access without changing defaults or initialization timing.
Checkout: feat/ai, fdd1697; pre-existing API package AI dependency, Astro allowedHosts, and lockfile changes preserved.
Continues: none

## Goal

Give each app a discoverable owner for environment names, parsing, and fallback values, and prevent scattered raw reads from returning.

## Result

API configuration is owned by [`src/utils/env.ts`](../../apps/api/src/utils/env.ts), reused by Node, the generated Edge bundle, Prisma/database configuration, seeds, and the standalone cleanup command. Web configuration has a public [`lib/env/env.ts`](../../apps/web/src/lib/env/env.ts) and server-only [`lib/server/config/env.ts`](../../apps/web/src/lib/server/config/env.ts); Astro config also imports the latter.

## Changes or findings

- Getters preserve API and server read timing. Existing import-time consumers still capture their values; Firebase and Storage remain optional until used.
- Existing port 3000, browser/server URL defaults, empty-string behavior, credential precedence, dotenv entry points, and cleanup safety checks remain intact.
- Added `pnpm check:env` to `pnpm check` and `pnpm test:env` for configuration behavior, Firebase initialization, request/session behavior, and deliberately broken checker fixtures. Tests and generated bundles are excluded from the source guard; private directories are skipped.
- Updated environment examples, root setup documentation, and frontend placement guidance. No presentation components, styles, database schema, or provider configuration changed.

## Decisions

Current ownership and loading rules are documented in the root README and the affected API/frontend structure references.

## Verification

Passed: full `pnpm check`; focused environment/Firebase tests; eight catalog SSR tests; existing request/session test; production web build; Edge bundle build; guidance check and nine guidance fixtures; scoped formatting and whitespace checks. Independent Terra review found no actionable issue. A built-server smoke check used an isolated HTTP fixture to verify runtime proxying and catalog SSR; client output contained no server env identifiers. Native Node imported the API TypeScript utility successfully.

## Remaining work

No implementation remains. Database-backed integration, actual served Edge runtime, browser sign-in, and live providers were not exercised. The web build reports a chunk-size warning.

## Resume here

Review the env utilities and `scripts/check-env.mjs` before extending configuration. Commit only when requested; preserve the pre-existing dirty work.
