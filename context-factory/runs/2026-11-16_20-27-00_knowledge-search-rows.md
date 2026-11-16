# Knowledge search rows

Started: 2026-11-16T20:20:00+08:00
Updated: 2026-11-16T20:27:00+08:00
Status: complete
Scope: User-requested top-five search limit, compact title/optional-thumbnail rows following the supplied reference image, and immediate package/service preview overlays.
Checkout: feat/ai at dd9bf62; existing uncommitted feature work preserved.
Continues: [Admin semantic catalog search](2026-11-16_20-13-00_admin-semantic-catalog-search.md)

## Goal

Make search results easier to scan and let the administrator preview a result without leaving the Knowledge Catalog.

## Result

The shared search limit is five, enforced by the existing server-side ranking service. Each result is one full-width button containing its package/service title and an optional 48px image on the left. Excerpts, similarity scores, type labels, and separate source-link buttons were removed from the rows. The response retains its existing metadata and rank order.

## Changes or findings

- Reused public Button, Panel, SearchField, notifications, and theme tokens. Page-specific row layout remains in `styles/ai/knowledge.css`; shared controls were not changed.
- `KnowledgeListingPreview` fetches through the existing admin package/service clients and composes the existing PackagePreview or CatalogDetailPreview/ServiceCanvas. The overlay appears before its data arrives, supports loading/error/retry, and ignores responses after closing. Package booking actions stay hidden.
- Updated the focused API assertion, README, and current AI standards. Prior runs remain historical.

## Decisions

Search still ranks knowledge chunks; this change does not add deduplication, change eligibility, reindex content, or connect the customer assistant.

## Verification

Workspace checks, web/Edge builds, design ownership, guidance checks and nine guidance tests passed. All four focused search API tests passed using a disposable migrated database and a synthetic embedding provider. Browser fixtures verified five title-only rows, optional left thumbnails, whole-row clicks, immediate loading overlays, both preview types without navigation, Enter/Escape and focus restoration, error/retry, and closing while a request is pending. Desktop/375px screenshots were inspected; no page errors or horizontal document overflow. The design detector found existing stylesheet advisories; the newly added radius was aligned with the documented scale.

## Remaining work

No requested work remains. No live model query, configured database mutation, or hosted rollout was performed for this refinement.

## Resume here

Refresh `/app/ai/knowledge` and search again. Start with `KnowledgeSearch.tsx` and `KnowledgeListingPreview.tsx` for further result/preview changes.
