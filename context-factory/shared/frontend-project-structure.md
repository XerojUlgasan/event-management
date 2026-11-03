# Frontend structure in Clemora

[Astro configuration](../../apps/web/astro.config.mjs) and [web scripts](../../apps/web/package.json) host and build the frontend. [index.astro](../../apps/web/src/pages/index.astro) imports app styles and mounts [App.tsx](../../apps/web/src/components/app/App.tsx). React selects the public, authentication, System Administrator, staff, and customer views in-page.

| Responsibility | Current owner |
| --- | --- |
| HTML entry point | `apps/web/src/pages/index.astro` |
| View selection and app shell | `apps/web/src/components/app/` |
| Workspace panels | `apps/web/src/components/app/pages/` |
| Customer workspace | `apps/web/src/components/app/customer/` |
| Shared message workspace | `apps/web/src/components/app/messages/` |
| Public catalog sections | `apps/web/src/components/PublicCatalog.tsx`, `PublicServiceCatalog.tsx`, and app catalog components |
| HTTP calls, session state, optional Firebase client | `apps/web/src/lib/api.ts`, `auth.tsx`, and `firebase.ts` |
| App styling and assets | `apps/web/src/styles/` and `apps/web/public/` |
| Reusable presentation and tokens | `packages/ui/` and `packages/theme/` |

Follow nearby patterns and [pages and structure](../frontend/reference/pages-and-structure.md). Do not add a parallel `src/routes` or feature-folder framework to mirror the source toolkit. Public catalogs use sections and overlays on `/`; a workspace view is not automatically a separate URL route. [Client data and auth](../frontend/reference/data-and-auth.md) distinguishes persisted flows from demo data.
