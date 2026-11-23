# Entity-owned catalog canvas JSONB

Date: 2026-11-16  
Status: accepted  
Authority: User instruction to store each package/service canvas in JSONB without versioning  
Implementation: implemented in source; applied to the configured loopback Supabase database, with no deployment claim for other environments ([migration](../../../apps/api/prisma/migrations/20261116072801_embed_catalog_canvas/migration.sql))

Superseded in part: the [assignment-removal decision](2026-11-18_remove-package-service-assignments.md) removes the relational `package_services` portion. The canvas JSONB decision remains in effect.

## Problem

Package and service canvas data was stored through separate catalog page, section, and widget tables. The current catalog save treats a canvas as one complete document owned by its package or service, and the accepted request excludes canvas/document versioning.

## Decision

Store the current canvas in `packages.canvas` and `services.canvas` as a plain JSONB sections array shaped as `[{ id, title, widgets: [...] }]`. Do not add a `schemaVersion` or document-version field. A canvas is saved as a whole on its owner. Package/service `updated_at` and the existing `expectedUpdatedAt` check remain the stale-write boundary; there are no independent section/widget versions.

Each widget keeps its current content and layout fields and refers to media by `mediaId`. The separate `media_assets` record remains authoritative for media source, kind, URL, MIME type, and storage metadata; uploaded bytes remain in Supabase Storage. `package_services` remains relational.

## Alternatives considered

- Retain the catalog page/section/widget tables: this preserves row-level relationships, but keeps canvas persistence separate from its package/service owner.
- Add document versioning to the JSONB canvas: this would introduce a version contract that the user explicitly excluded.

## Rationale

The package or service owns the canvas lifecycle, and the editor submits a whole-canvas save. Keeping media assets and package/service links outside JSONB retains their separate ownership and relational behavior without adding a canvas-versioning requirement.

## Consequences

Validation placement is superseded by the [application validation decision](2026-11-16_catalog-canvas-application-validation.md). The paragraph below records the original implementation; entity-owned JSONB remains accepted.

The API and database validate the sections/widgets document. GIN indexes on each owner canvas support JSONB containment for media reference, permission, and cleanup checks. Upload locking and permission rules, private proposal media copies, `media_assets`, uploaded Storage objects, and package-service relations retain their existing behavior.

Migration `20261116072801_embed_catalog_canvas` adds both JSONB columns, backfills existing section/widget IDs, display order, content/layout fields, and media IDs without changing package/service timestamps, then drops `catalog_widgets`, `catalog_sections`, and `catalog_pages`. Deploy the matching API with the migration. The migration was applied to the configured loopback Supabase database for this task; this does not establish deployment to another environment.

Seeded canvases initialize only when a package or service owner is newly inserted. Reruns preserve saved edits, including an intentionally empty canvas; the previous fill-missing-canvas-child behavior no longer applies.

## References

- [Root implementation and migration impact](../../../README.md#catalogs-and-media)
- [Database and migration guidance](../../areas/api/references/database-and-migrations.md#entity-owned-catalog-canvases)
- [Catalog media ownership and cleanup](../../areas/api/references/external-image-urls.md)
- [Shared catalog limits](../../areas/contracts/references/shared-limits.md)
- [Seed behavior](../../../docs/SEED.md#repeat-runs-and-collisions)
