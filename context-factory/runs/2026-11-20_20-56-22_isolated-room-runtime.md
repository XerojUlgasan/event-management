# Isolated room runtime

Started: 2026-11-20T20:56:22+08:00
Updated: 2026-11-20T21:08:05+08:00
Status: complete
Scope: Make room creation/start deliver an isolated, migrated, seeded, running test environment; preserve primary runtime and unrelated work.
Checkout: main started at f853607 with unrelated messaging changes; concurrent external commits advanced it to 5db7df6. This task made no commits. test remains detached at 768f25a; check at f853607.
Continues: none

## Goal

Creating or starting a room must install dependencies, deploy the selected revision's migrations, seed test data, start its services, and verify readiness. Rooms require independent ports, browser hosts, containers, database and Storage, with short names.

## Result

`test` is ready at http://127.77.0.1:20001 (API port 20000; Studio 20005; database 20003). `check` was prepared and tested concurrently, then stopped with its worktree and data retained. Original container identities and unrelated dirty-file hashes were preserved.

## Changes or findings

- [Runner](../../scripts/room.mjs) and [12 tests](../../scripts/room.test.mjs) own lifecycle, private state, port allocation, environment and socket/process ownership checks.
- The [guide](../workflows/implement/references/worktrees.md), README, package scripts and routing require complete preparation. Node API/worker source changes require stop/start.
- Selected worktrees supply migrations/seeds/dependencies. Runtime targets their own Supabase database and Storage; ordinary primary startup stays unchanged.

## Decisions

Use separate Supabase projects instead of shared-database schemas or environment overrides alone. Distinct loopback hosts isolate browser cookies. Retain data on stop/restart and keep optional AI credentials explicit per room. Realtime, mail, analytics, Edge and Storage vector services are disabled; SQL pgvector remains available. Supabase Auth stays enabled because CLI status otherwise omits Storage credentials.

## Verification

Twelve room tests, nine guidance tests, structural guidance checks, focused lint/format/syntax and diff checks pass. Both rooms deployed every selected migration and seeded users/catalogs. Real API, SQL and Storage checks proved cross-room session rejection and isolated persisted account/upload data. Browser login and populated catalog passed; browser session, task-created account and upload survived restart. Healthy start skipped reseeding; occupied API port refused startup before seed/network requests. Isolation probes were cleaned up.

Independent review approved after one repair cycle: fail-fast API startup and actual listener ownership prevent foreign HTTP from passing readiness; Astro's relative config path fixes startup. Requested Terra exploration/Sol implementation/review routing; actual model metadata is unconfirmed.

## Remaining work

No required work remains. Live AI/provider behavior and Edge execution were not verified; optional AI needs room-specific settings. Runner currently requires Linux.

## Resume here

Run `pnpm room status test` or use `pnpm room create <name> <revision>`. Preserve existing rooms and private `.room/.state/` data; stop only the selected room. See the guide for cleanup and optional providers.
