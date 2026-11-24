# Catalog widget redesign

Started: 2026-11-24T18:36:33+08:00
Updated: 2026-11-24T19:10:59+08:00
Status: complete
Scope: Improve existing catalog layouts and design the Markdown content for fresh package and service seeds.
Checkout: Local main at integrated commit `ae4485a9`.
Continues: [Expanded catalog Markdown](2026-11-24_18-14-00_catalog-markdown-integration.md)

## Result

[Public details and full previews](../areas/frontend/references/styling-and-verification.md#catalog-canvas) let Markdown take the height it needs. Wide canvases preserve saved placement and intentional gaps. Narrow canvases stack in reading order. Headings align with the widget gutter, photos retain their aspect ratio, and the renderer styles list markers, callouts, and tables. The authoring editor retains its grid and 3×2 resize minimum.

All 80 seed bodies received content-specific formatting while preserving the listings, planning detail, and assets. The [Markdown design brief](../../docs/specs/catalog-markdown-design.md) has examples for programs, inclusions, venue conditions, and menus. Fresh catalog rows use the revised copy. Existing rows retain their saved Markdown.

## Verification

- The merged checkout served the new renderer on `localhost:4321` and on a separate preview connected to fresh disposable data. Chromium opened all 20 detail pages at 320, 390, 594, 595, and 1280 px in each environment. All 200 visits passed text-fit, overlap, photo, and document-width checks. The newly authored lists had visible bullets and numbers. Both service links opened their destination with its thumbnail loaded.
- In the existing catalog, Garden Wedding’s desktop “From the aisle to dinner” text widget shrank from 1,361 px to 343 px. That section now measures 601 px and 591 px on either side of the stacking breakpoint. The before-and-after API digest matched for all existing catalog records.
- The layout check also exercised preview, editor resizing, keyboard navigation, wide Markdown content, and native video in isolation. On main, 42 catalog tests, three seed and sample-photo tests, web structure, and web and UI type checks passed. The guidance unit suite passed. The guidance link and design checks reported their existing historical-link and message-style findings.

## Resume here

Refresh [Garden Wedding](http://localhost:4321/packages/garden-wedding-under-the-lights) for the existing catalog or open the [fresh cocktail menu](http://127.0.0.1:50181/services/cocktail-and-mocktail-bar) for the new copy and layout together. The fresh preview uses the local `clemora-catalog-redesign-web` service and the disposable API at port 28770. The [seed guide](../../docs/SEED.md) describes how to reproduce it with a fresh database.
