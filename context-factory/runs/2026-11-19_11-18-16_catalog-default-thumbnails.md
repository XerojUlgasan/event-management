# Catalog default thumbnails

Started: 2026-11-19T11:18:16+08:00
Updated: 2026-11-19T11:18:16+08:00
Status: complete
Scope: Implement the approved dedicated-thumbnail-or-default rule for packages and services; no thumbnail migration, backfill, deployment, or existing-content edits.
Checkout: main at ebb4263; initially clean; unrelated messaging/image work appeared during execution and was preserved.
Continues: none

## Goal

An administrator-set thumbnail overrides the default. An unset or failed thumbnail displays the branded default across public, customer, and admin cards. Canvas photos remain independent.

## Result

Shared `CatalogThumbnail` presentation uses the supplied AMAC logo and theme tokens. Main cards, linked listing widgets, reference pickers, and editor card previews reuse it. React errors reveal the default; public server-rendered pages use a capture listener and completed-image check without hydrating the catalog. Linked images retain contain fitting, and default artwork fits shallow widgets.

## Changes or findings

- Package/service DTOs and linked-reference projections return only the dedicated thumbnail URL or null. Existing nullable contract shapes remain valid.
- Removing a thumbnail no longer exposes the first canvas photo as its replacement. Actual canvas media and access rules are unchanged.
- README and the media reference describe the approved rule. No thumbnail database migration is needed.

## Verification

All 36 API checks passed serially, including default/set/replace/remove reads for both kinds, public/customer/admin access, linked cards, and retained canvas photos. An initial parallel run encountered session lookup failures; the package suite also passed alone (23 checks). All 22 web catalog tests, UI/API type checks, Storybook/web builds, Edge bundling, nine guidance tests, and diff checks passed.

Local browser checks covered failed-image recovery in all six main card combinations, mobile admin layout, and an unsaved package preview transitioning default → uploaded image → remove → default. The task-created upload was deleted through the admin API and its absence verified; sessions and tabs were closed. Independent Terra review findings were corrected and rechecked.

## Remaining work

Workspace checks remain blocked by existing thumbnail-hook placement and design issues. A later web typecheck encountered an unrelated concurrent messaging callback type error; the web build passed. Hosted rollout, existing missing image-file repair, and exhaustive browser coverage of linked/picker variations were not performed.

## Resume here

Review `packages/ui/src/atoms/CatalogThumbnail.tsx`, the catalog response projections, and the scoped thumbnail diff. Preserve concurrent messaging work. Deploy matching API/frontend when separately authorized.
