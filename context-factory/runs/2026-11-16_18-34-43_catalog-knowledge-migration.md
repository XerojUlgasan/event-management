# Catalog knowledge migration

Started: 2026-11-16T18:34:43+08:00
Updated: 2026-11-16T18:35:38+08:00
Status: complete
Scope: User-authorized migration for the agreed single table and 768-dimensional embeddings. Disposable local database verification only; no application database deployment or provider calls.
Checkout: feat/ai at dd9bf62; pre-existing `apps/api/.env.example` edit preserved.
Continues: [Catalog canvas validation](2026-11-16_16-56-00_catalog-canvas-validation.md); user supplied an investigation-only catalog embedding handoff in chat.

## Goal

Create the agreed catalog knowledge schema and a reviewable, verified migration without implementing ingestion or retrieval.

## Result

Prepared migration `20261116103220_add_catalog_knowledge`, the matching Prisma model, generated Kysely types, and a focused migration suite. The table has ten agreed columns, including `content_markdown` and nullable `vector(768)`.

## Changes or findings

- Enforces exactly one package/service owner, owner-local chunk uniqueness, nonempty keys/hashes, complete pending/populated embedding state, and owner/media deletion cascades.
- Enables pgvector while reusing its installed schema. Local PostgreSQL provides pgvector 0.8.2; it remains disabled in the configured application database.
- Enables RLS and removes `PUBLIC`, `anon`, and `authenticated` table grants. No direct-client policies or retrieval index are introduced.
- Existing records and media are unchanged. Generated types came from a disposable migrated database through `pnpm db:generate`, not a manual edit.

## Decisions

See [catalog knowledge storage](../history/decisions/2026-11-16_catalog-knowledge-storage.md). Model selection, chunk splitting, refresh timing, actual-image versus text-only photo embeddings, and sample/video treatment remain unresolved.

## Verification

Six focused migration/access tests passed without skips, covering fresh public-schema pgvector and a pre-existing extensions-schema installation. Three existing RLS tests and nine guidance tests passed without skips. Disposable Prisma deployment and schema diff, Prisma validation, workspace checks, guidance links/routing, scoped formatting, and diff checks passed. The affected engineering/schema, contributor-documentation, continuation, and decision-record routing scenarios were inspected. A final read confirmed the table/migration are absent from the configured application database and no task disposable databases remain.

## Remaining work

No required migration-authoring work remains. Application database deployment, extraction, source eligibility enforcement, invalidation, stale-write guards, retrieval, browser, and provider verification are outside this slice. Plain PostgreSQL images need pgvector installed before deployment; the tested local Supabase server already provides it.

## Resume here

Review the new migration and decision. Do not apply it to configured databases or make provider calls without the corresponding task authorization. Preserve the unrelated environment example edit.
