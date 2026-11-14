# Database and migrations

## Ownership and workflow

`apps/api/prisma/schema.prisma` and `prisma/migrations/` own schema changes; runtime queries use Kysely in `src/data/`. `src/db/types.ts` is generated from the migrated database by `pnpm db:generate`; never hand-edit it. Prisma configuration resolves its connection through `src/db/config.ts`.

For a schema change, inspect existing migrations and constraints, update the Prisma schema where applicable, create and review the migration with `pnpm db:migrate`, regenerate types from the migrated database, update consumers, and run relevant checks. `pnpm db:deploy` applies committed migrations; it does not create one. SQL-only access changes need no Prisma or Kysely regeneration. Inspect the target and impact before any migration, seed, or test; keep connection values private.

New application tables must enable RLS and remove unused `PUBLIC`, `anon`, and `authenticated` grants. API access relies on the server role owning tables or having `BYPASSRLS`; Supabase roles may be absent on Compose. Existing migrations do not automatically protect future tables. Use `test:rls` and note when role-specific checks are skipped.

## Environment and destructive history

The local Supabase stack and Edge function are separate from the Compose PostgreSQL used by the Node API, Prisma, seeds, and integration tests. Read [local setup](../../../../README.md#local-supabase), current scripts, and environment target before operating either stack. See [seed guidance](../../../../docs/SEED.md) for insert-only scenario behavior and fixtures.

Inspect every pending migration before deployment. Earlier migrations can remove package records and linked history; `20261114000000_drop_venues` removes the venue catalog and `20261114010000_drop_staff_tables` removes availability/assignment tables and event-day response fields. The additive `20261114151517_complete_catalog_staff_removal` migration converts non-designated admin and staff accounts to customers and revokes their sessions, removes the remaining role and coordinator/checklist-delivery fields, deletes ownerless catalog pages, and restores the package/service page-owner constraint while retaining shared media assets. Follow-up migration `20261114154206_remove_event_checklists` drops the checklist table and validator, including existing task data. Run the existing `pnpm --filter @event-management/api media:cleanup` command to remove stale unreferenced media. Back up affected data when its history matters. The root [migration impact](../../../../README.md#migration-impact) and migration SQL own the details.

For booking requests, private proposals, quotations, or media, inspect their migrations and current service invariants together. Inquiry snapshots remain separate from private proposals; quotations retain financial history rather than package/media snapshots. See [catalog media](external-image-urls.md) before changing storage references or cleanup.
