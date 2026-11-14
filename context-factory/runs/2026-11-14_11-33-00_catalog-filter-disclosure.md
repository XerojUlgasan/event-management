# Catalog filter disclosure

Started: 2026-11-14T11:30:00+08:00
Updated: 2026-11-14T11:33:00+08:00
Status: complete
Scope: Hide customer catalog filters until the filter icon is clicked. Preserve the previous catalog implementation and unrelated uncommitted work.
Checkout: main, 5fb0b9c, with the preceding catalog changes uncommitted.
Continues: [Customer catalog browsing](2026-11-14_11-29-00_customer-catalog-browsing.md)

## Goal

Keep browsing compact and reveal the filter controls only on request.

## Result

All three catalog tabs start with collapsed filters. A funnel icon beside the results count toggles the existing form. Its accessible name and expanded/controlled state describe the disclosure. The form stays mounted while hidden, preserving entered values, validation, and active filters. Active filters also tint the trigger and remain reflected in the results summary.

## Changes or findings

Reused the shared icon-size Button and extended the shared Icon inventory and gallery with a filter glyph. Fetching, contracts, and pagination behavior are unchanged. Updated the root README's implementation description.

## Verification

Web structure, Astro diagnostics (zero errors/warnings/hints), UI TypeScript, Storybook build, formatting, and diff checks passed. Browser checks covered default collapse, mouse and Enter activation, close/reopen value retention, applied results, Clear, and category-specific filters at normal and mobile widths. The two existing `check:design` failures remain in untouched `PublicDocument.astro` and `admin-event-days.css`; see the predecessor for details. No API/database tests were rerun for this presentation change.

## Remaining work

No requested work remains. Changes are uncommitted and not deployed.

## Resume here

Review `PublicCatalog.tsx`, catalog CSS, and the Icon inventory/gallery for this follow-up; the predecessor records the full catalog implementation and its API evidence.
