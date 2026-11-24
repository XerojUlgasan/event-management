# Compact catalog widgets

Started: 2026-11-24T17:39:00+08:00
Updated: 2026-11-24T18:01:00+08:00
Status: complete
Scope: Reduce the editor minimum to three columns and two rows and tighten fresh catalog seed layouts.
Checkout: Local `main` after integration at `9de8a026`.
Continues: [Catalog and showcase seed preview](2026-11-24_17-14-00_catalog-seed-preview.md)

## Result

The shared [catalog editor](../../apps/web/src/components/catalog/CatalogEditor.tsx) uses a 3×2 minimum for keyboard and pointer resizing. Smaller saved widgets still open at their stored sizes and can move or grow. New widgets start at 12×5, and the mobile editor stacks its widgets full width.

The [seed builder](../../apps/api/src/db/seed/curated-catalog.ts) aligns side-by-side photos and copy, keeps five opening layouts, and sizes Markdown and linked-service cards for the grid and narrow stack. The spacing applies when the seed first inserts a catalog listing. Showcases use covers and ordered galleries. [Seed guide](../../docs/SEED.md)

## Verification

- In the root admin editor, Chromium verified both resize inputs and their bounds, the legacy 1×1 case, the 390px stack, and the saved result after reload. The authenticated GET and database JSONB matched the displayed layout.
- A fresh preview database and private Supabase Storage bucket held 10 packages, 10 services, three public showcases, and 75 images. All 186 Chromium page and viewport checks passed. Package and service cases covered widths from 320px to 1280px, including both sides of the grid breakpoint. The second seed run produced identical stored catalog canvases.
- The 41 web catalog tests, four focused seed tests, API and web type checks, and web structure check passed. The scoped lint and design checks still reported two existing test-formatting findings and one existing message CSS finding.

## Resume here

Open the local [admin package editor](http://127.0.0.1:4881/app/packages) to try the resize grip or Shift plus arrow keys. Browse [packages](http://127.0.0.1:4881/packages) or [services](http://127.0.0.1:4881/services) for the fresh layouts. The preview is a disposable local database and Storage bucket. The user service names are `clemora-widget-integrated-web` and `clemora-widget-integrated-api`.
