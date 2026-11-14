# Customer catalog browsing

Started: 2026-11-14T11:19:00+08:00
Updated: 2026-11-14T11:29:00+08:00
Status: complete
Scope: Improve customer catalog navigation, pagination scrolling, and shared price/guest filters; investigate and inspect the UI before implementation. No deployment, shared-data migration, or reset.
Checkout: main, baseline 5fb0b9c; scoped changes remain uncommitted.
Continues: none

## Goal

Replace the customer Packages destination with Catalogs and Packages/Services/Venues tabs. Add understandable filters backed by shared contracts and return customers to the catalog top on Next/Previous.

## Result

Implemented and verified locally. `/app/catalogs` is the customer destination; legacy `/app/packages` links still work. Category selection survives browser history and reload. Mobile navigation fits all four customer destinations.

## Changes or findings

- Reused shared Tabs, FormField, Input, Button, PageHeader, and Pagination with existing theme tokens. Customer page composition, filter form, fetching, and scrolling stay in the web app; no shared UI API changed.
- `contracts/catalog-filters` owns query types, bounds, and cursor scopes. API filters apply before pagination. Package prices are total pesos, service prices are pesos/hour, and venue filters use capacity. Guest counts match capacity at least the entered count, as confirmed by the user. Unknown rates/capacities are excluded only under the corresponding filter.
- Updated current implementation and contract/reuse guidance. Business catalog rules already match the intended browsing scope.

## Verification

- Terra implementation: API package tests 16/16 and venue tests 5/5; disposable migrated databases and fake Storage, no shared database writes.
- Lead: `pnpm check`, `pnpm build`, `pnpm build:edge`, web catalog SSR 8/8, navigation/query tests 6/6, guidance tests 9/9, structure, formatting, and diff checks passed. Final web check has no errors, warnings, or hints.
- Browser: real local customer session and Edge API; all categories, combined package filters, service hourly rates, venue capacity, filtered pagination, scroll/focus, keyboard tabs, history/reload, invalid range, empty recovery, and package preview/Book now verified at desktop and narrow mobile widths.
- Independent Sol source review found no actionable defects. Impeccable detector returned no findings. `pnpm check:design` still fails on the raw checkbox in `PublicDocument.astro:29` and literal `transparent` in `admin-event-days.css:72`; both exist in baseline and are untouched.

## Remaining work

No requested implementation remains. Production deployment/provider behavior was not tested; the two existing design-check failures remain outside scope.

## Resume here

Review the uncommitted diff starting at `CustomerCatalogPage.tsx`, `PublicCatalog.tsx`, and `contracts/src/catalog-filters.ts`. Use the normal commit/PR process if requested; no deployment was authorized.
