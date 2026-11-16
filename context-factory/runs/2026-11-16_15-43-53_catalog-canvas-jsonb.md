# Entity-owned catalog canvases

Started: 2026-11-16T15:43:53+08:00
Updated: 2026-11-16T15:43:53+08:00
Status: complete
Scope: Implement user-approved package/service JSONB canvases without document versioning, remove obsolete persistence, and verify tests and UI. Local migration and disposable test fixtures; no hosted deployment or commit.
Checkout: feat/ai at 4c2032f; canvas changes remain uncommitted. Checkout was clean at implementation startup.
Continues: none

## Goal

Store each package/service canvas directly on its owner, preserve catalog/media behavior, and remove the former page/section/widget storage.

## Result

`packages.canvas` and `services.canvas` hold ordered sections arrays without a version field. Existing editor and renderer contracts remain unchanged. The local configured Supabase database has the migration applied; temporary test services, fixtures, sessions, and database were removed.

## Changes or findings

- The additive migration backfills IDs, array order, text, geometry, autoplay, and media references before dropping all three old tables. A before/after local comparison confirmed all owner fields and exact timestamps, complete canvases, and media records were preserved.
- Shared runtime validation/hydration resolves media IDs through `media_assets`. GIN-backed containment replaces former widget joins for access, ownership, and cleanup. Upload locking, private proposal copies, stale-save checks, and relational service links remain.
- Removed old runtime queries/imports and generated DB types. Seeds initialize nested content only with new owners, preserving edited and intentionally empty canvases on rerun. Historical migrations and their regression tests remain as replay evidence.
- Terra implemented runtime/tests; Luna synchronized current docs. Sol independently reviewed the consequential changes with no actionable findings.

## Decisions

Accepted [entity-owned JSONB canvas](../history/decisions/2026-11-16_catalog-canvas-jsonb.md), including the user's explicit exclusion of document versioning.

## Verification

55 API/migration/seed/RLS/SSR tests and 9 guidance tests passed. Workspace type checks, Prisma validation, web production and Edge builds, formatting, guidance links/routing, and diff checks passed. Existing build chunk-size warnings remain.

Browser checks against disposable PostgreSQL and the production web build verified package creation, widget movement, save/reload, service photo/Markdown edit and reload, and both public detail pages. A sample image loaded. Rebuilt local Supabase Edge returned successful package/service reads after migration. Screenshot evidence is stored outside the repo in the chat artifact directory. UI components required no changes.

## Remaining work

Hosted deployment and real Storage upload/copy behavior are unverified; integration media tests use fake Storage. No required local implementation remains.

## Resume here

Review the scoped diff and migration before separately authorized commit/deployment. Start with the decision, `catalog-canvas.ts`, and the migration. Never reset to resolve migration drift.
