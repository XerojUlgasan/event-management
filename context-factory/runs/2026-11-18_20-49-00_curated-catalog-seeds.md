# Curated catalog seeds

Started: 2026-11-18T20:35:25+08:00
Updated: 2026-11-18T20:54:00+08:00
Status: complete
Scope: User-authorized realistic, diverse package/service canvas seeds; user selected a smaller curated catalog and actual web photographs. No shared-database reset, reseed, live embedding calls, commit, or deployment.
Checkout: main at 1157772; initially clean.
Continues: [Public catalog item tool](2026-11-18_20-29-13_public-catalog-item-tool.md).

## Goal

Understand current AI tools and image/Markdown ingestion before replacing generic catalog fixtures, then prove valid, distinct canvases, coherent catalog filters/details, and repeat-run preservation.

## Result

The seed now plans 20 curated packages and 20 services (18 active and two archived each), plus richer canvases for the three original named package samples. A fresh database has 43 canvases, five layout compositions, varied capacities/prices, fixed and hourly services, truthful photo descriptions, scope/timing/exclusions, and contextual linked listings. The 100 booking scenarios remain.

## Changes or findings

- `seed/curated-catalog.ts` owns copy and layout construction. Owner initialization remains insert-only; existing or intentionally empty canvases survive reruns. Dependent bookings read stored package state; versioned media IDs avoid legacy orphan collisions.
- Six attributed Pexels photographs join the four existing samples. Shared validation, Node reads, and Edge bundling consume one allowlist. An additive constraint migration permits the six exact new paths without changing upload restrictions.
- The assistant recommends through public search and current Markdown details. Preparation indexes overview, Markdown and actual photo bytes; seeded SQL does not schedule embedding refresh. The [seed guide](../../docs/SEED.md#ai-catalog-demo) records demo prompts and the provider-backed backfill boundary.
- Terra investigated, implemented content/assets, and independently reviewed; Luna implemented regressions. The lead integrated and verified the changes. Existing canvas renderers, contracts, and styles were reused.

## Verification

API/web/UI type checks, Prisma validation, Edge bundling, 20 integrated seed/media/AI/migration tests, 21 web catalog tests, and nine guidance tests pass. The seed suite covers 43 canvases, knowledge preparation, filters/details, booking/quotation integrity, rerun preservation, persisted-state planning, and orphan-photo isolation. Synthetic browser previews of all 40 curated canvases at wide and narrow widths pass 80 clipping/image/overflow checks. Independent Terra source/test review found no remaining actionable issues. Scoped formatting and final diff checks pass. Temporary preview and test databases were cleaned up.

## Remaining work

No required seed implementation work remains. Existing web-structure issues in `use-thumbnail.ts` and design issues in `ThumbnailField.tsx`/`package-editor.css` remain outside this change. Shared data and live provider ranking are untested; an older seeded database retains older listings by design.

## Resume here

Review the scoped diff and the seed guide before applying the migration and seed to a fresh demo database. Applying the new catalog to a populated database or running paid embedding backfill remains a separate operation; never assume an insert-only rerun refreshes old fixtures.
