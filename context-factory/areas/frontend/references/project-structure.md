# Frontend project structure

This is the placement and naming contract for `apps/web`. Apply it to new files, moves, and edits; inspect the affected flow and existing owners first. [Frontend](../SKILL.md) and [packages](../../packages/SKILL.md) remain mandatory for UI work. Astro hosts public documents and mounts `components/app/App.tsx` for `/login` and `/app/*`; workspace history is handled by `lib/navigation/workspace-navigation.ts`.

## Placement

Organize by **layer → domain → responsibility**. A domain is a product concept or a named infrastructure concern; a responsibility is a cohesive screen, operation group, sequence, or helper. Use an existing domain when it owns the behavior. Create a domain only when it has a concrete consumer and responsibility. For a new shared component domain, register it deliberately in `scripts/check-web-structure.mjs` and update this placement guide in the same change. Do not create empty scaffolding or generic `shared`/`common` dumping grounds.

```text
src/
  env.ts                         environment configuration
  pages/                         Astro routes and route-owned handlers
  layouts/                       Astro document layouts
  components/
    app/                         App.tsx, routes.ts, navigation-types.ts
    auth/                        sign-in composition
    booking-requests/            cross-workspace booking compositions
    catalog/                     catalog compositions shared by public and workspace
    messages/ notifications/ quotations/
    public/catalog/ public/site/ public-only composition
    workspaces/admin/            admin shell and sidebar
      booking-requests/ catalog/ event-days/ ... role-specific screens
    workspaces/customer/         CustomerDashboard role entry
  lib/
    auth/ http/ navigation/ pagination/  named infrastructure
    data/<domain>/               direct API calls and their data helpers
    services/<domain>/           client sequences, storage, response combination
    utils/<domain>/              pure transformations
    server/<domain>/             server-only loading and helpers
  demo/<domain>/                 explicit sample data
  styles/<domain>/               app-specific CSS
    styles/workspaces/<role>/      admin/customer-specific CSS
  styles/app.css                 deliberate root stylesheet entry point
public/                          static assets
tests/<domain>/                  tests grouped by affected behavior
```

`components/workspaces/<role>/` owns the admin or customer shell and navigation, with domain screens in named subfolders. The customer role entry `CustomerDashboard.tsx` is also permitted directly under its role. A component used across roles or by public and workspace views belongs in its domain folder, not a role folder. `components/public/` owns public-only compositions. `components/app/` is limited to the three entry and navigation files above. Keep public URLs in `pages/`; do not invent a parallel route framework or browser controllers. Sample photos and bookings belong under `demo/catalog/` and `demo/booking-requests/`; admin navigation belongs to the admin workspace, not demo data.

`lib/data/catalog/{packages,services,media,page-query}.ts` and `lib/data/booking-requests/{requests,packages}.ts` illustrate cohesive responsibility groups. Multiple related operations may share one file; split when responsibilities meaningfully differ, not one file per endpoint. The HTTP wrapper is `lib/http/request.ts`. The `auth`, `http`, `navigation`, and `pagination` infrastructure modules are explicit exceptions to domain grouping inside `lib`. `styles/app.css` is the stylesheet entry exception. Place new app styles under their domain and import them from the appropriate entry. Shared presentation belongs in `packages/ui`, shared tokens in `packages/theme`, and established shared contracts in `packages/contracts`; follow the [reuse workflow](../../packages/references/reuse.md#required-workflow-for-every-ui-change).

[`src/env.ts`](../../../../apps/web/src/env.ts) exports `config` for the browser, web server, and Astro config. Browser consumers use its public settings, which Vite supplies at build time. Server-only getters read the runtime environment and are guarded in client builds. Astro config can read shell settings before Vite initializes. `pnpm check:env` checks direct environment reads in app source, excluding tests and generated bundles.

## Names and dependencies

| Item | Required name | Example |
| --- | --- | --- |
| Domain and responsibility folders | kebab-case | `booking-requests/` |
| React component files and their primary component | matching PascalCase | `AdminShell.tsx` → `AdminShell` |
| Non-component TypeScript, CSS, and test files | kebab-case, with `.test` for tests | `booking-dates.test.ts` |
| Functions and variables | camelCase | `durationLabel` |
| Types | PascalCase | `BookingRequest` |
| Astro routes | framework route syntax | `pages/packages/[slug].astro` |

A component file with one primary component must name its export to match the filename. Cohesive renderer or display-group modules may export related components or helpers without an identically named primary export: `CatalogContent.tsx`, `PublicCatalogDetail.tsx`, and `BookingRequestDisplay.tsx` are examples. Name new hook files `use-<responsibility>.ts` and export a camelCase `useResponsibility` function. Use `Page` for a screen, `Shell` for a role layout, `Dialog` for a dialog, and `Editor` for an editing composition. Preserve framework entry/configuration names and package-owned naming conventions. Component filenames describe the responsibility (`ServicesPage`, not `ServicesPanel` when it is a page). Avoid aliases and re-exports that exist only to preserve a moved path; migrate callers and remove the old path.

Dependencies flow from route and screen composition to client services or data, then to HTTP and contracts. Services may call data and pure utilities; data may call HTTP and data helpers, but must not depend on components or client services. Pure utilities must not depend on React, HTTP, or storage. Server modules remain server-only and must not enter browser runtime imports; type-only imports do not introduce runtime dependencies. Keep screen state and navigation in the app; API validation, business services, authorization, and SQL remain in `apps/api`. Use [client layers](client-layers.md) for request details and [API synchronization](../../contracts/references/api-type-sync.md) for contracts.

## Preflight and completion audit

1. Trace callers, imports, relevant tests, and current package exports. Choose the owning layer and domain before adding or moving files; check whether the responsibility is shared across roles or public and workspace views.
2. Update imports and references together. Preserve URLs, auth, API contracts, and visual behavior unless the user authorized changes. Update affected current guidance; preserve clearly historical records.
3. Run `pnpm check:web-structure` (also included in `pnpm check`), the relevant web checks and tests, and `pnpm check:guidance` for guidance changes. Apply the package reuse audit for UI work and inspect rendered behavior when the change requires browser evidence.
4. Inspect the changed paths and dependency direction against this guide. The automated structure check enforces configured placement and filename patterns, resolves literal local imports, exports, dynamic imports, CSS imports, `ssrLoadModule` paths, and `import.meta.url` resources. It checks runtime boundaries from libraries to components, data to services, pure utilities to data/services/auth/HTTP/server and React or Firebase Storage, browser modules to server modules, and shared components to role workspaces or app bootstrap. Only the browser-to-server restriction permits type-only imports; other layer restrictions apply to value and type imports. Shared components may use the app route and navigation-type modules. The check does not inspect component export names or computed imports, decide semantic domain ownership, or prove runtime behavior. Report any unverified behavior and failed or unavailable checks.
