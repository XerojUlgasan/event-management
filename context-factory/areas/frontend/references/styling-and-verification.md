# Styling and verification

Use theme tokens from `packages/theme/src/theme.css`, shared component styles from `packages/ui/src/styles.css`, and page styles under `apps/web/src/styles/`. CSS-only changes follow the [reuse workflow](../../packages/references/reuse.md). Preserve semantic controls, accessible names, keyboard behavior, and responsive states.

## Catalog canvas

The shared UI package owns the canvas, section, widget, Markdown renderer, and `CATALOG_GRID` metrics; `CatalogContent.tsx` owns entity composition and media URL resolution. Guides and ruler must represent the actual snap columns. Section height derives from the lowest widget edge, including intentional gaps, and preview counts follow drag/resize. Narrow screens distinguish the stacked view from saved coordinates. Check shared widget limits for keyboard and pointer changes.

Keep editor, preview, and public rendering aligned at the same viewport. Preserve uncropped media, clipped widget overflow, shared sanitized Markdown, and the separate Markdown editing dialog. The grid library hides its resize handle by default; app overrides keep an adequately sized grip visible and above media. Verify hover, focus, touch, narrow layouts, undo, dialog dismissal, and focus restoration when affected.

## Checks

Run `pnpm check:web-structure` for placement and import boundaries, the relevant web check/build and tests from `apps/web/package.json`, and `pnpm check:design` for its configured static design checks. Catalog SSR tests do not prove layout or native playback. Shared changes also require the [package checks](../../packages/references/theme-and-verification.md).

Inspect affected browser or Storybook states and consumers at relevant viewports when available. Builds and static checks do not prove interaction, responsive layout, or login. Complete the [reuse audit](../../packages/references/reuse.md#completion-audit) and report missing evidence.
