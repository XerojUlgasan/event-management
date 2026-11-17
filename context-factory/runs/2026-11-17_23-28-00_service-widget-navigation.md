# Service widget navigation

Started: 2026-11-17T23:28:26+08:00
Updated: 2026-11-17T23:37:12+08:00
Status: complete
Scope: Whole-card public navigation and workspace-only preview overlays. User clarified the destination is the selected service's details. No commit, push, or hosted deployment requested.
Checkout: main at e6b110a, preserving the preceding widget and unrelated booking-intake changes.
Continues: [Service canvas widget](2026-11-17_23-12-00_service-widget.md)

## Goal

Make the entire service widget actionable in previews and public views. Public actions navigate to the selected service; `/app` actions retain the workspace route and open a preview overlay. Editor center clicks retain the service picker.

## Result

Implementation, local browser proof, final build, documentation checks, and cleanup are complete. Luna traced callers, Terra implemented the scoped UI changes, and Sol independently reviewed the integrated source without actionable findings.

## Changes or findings

- Shared cards use one public anchor or workspace button, covering the image, name, description, and caption. Editor content remains passive inside its picker button; unavailable cards remain inert.
- The authenticated workspace provides one service overlay. Following linked services replaces its content without recursively stacking service dialogs. Route/account changes clear the selection; loading, retry, and stale-response guards follow existing app patterns.
- A counted catalog scroll lock fixes browser Back closing stacked previews in parent-first order and leaving the page unscrollable. Existing catalog dialog owners share it.
- Current behavior is documented in the [root README](../../README.md#catalogs-and-media); the original widget's business scope remains unchanged.

## Verification

- All 19 web catalog tests pass, including whole-card markup, passive editor/unavailable states, and scroll restoration in either close order. Workspace/type/design checks, normal production build, and Storybook build pass; bundle-size warnings remain. The design detector's only finding is an unchanged warning accent border in shared styles. Guidance checks and all nine guidance tests pass; scoped formatting and whitespace checks pass. Affected UI/shared component, continuation, and documentation routes were inspected against the routing scenarios.
- Actual production frontend with a disposable migrated PostgreSQL database and local API: public image click navigated to the service page; admin and customer workspace actions retained their URL; editor edit mode opened the picker and preview mode opened the overlay. Enter, Escape, focus restoration, narrow width 390, A-to-B-to-A service links, and browser Back/scroll restoration passed.
- Source review is separate from browser proof. No live provider or hosted deployment proof is claimed; no application database changes were needed.

## Remaining work

No required implementation remains. Task-created servers, disposable fixture database, script, and metadata were removed; browser viewport was restored and the active test tab closed. The normal production build was restored after browser testing. Screenshot evidence remains outside the repository. Hosted rollout remains unverified.

## Resume here

Review the uncommitted navigation delta alongside the preceding widget work. Inspect `ServiceNavigationProvider.tsx`, the shared `CatalogCanvas.tsx`, and `catalog-scroll-lock.ts` for future navigation changes; preserve the user's service-detail destination and editor picker behavior. Commit, push, and deployment remain separate authorization.
