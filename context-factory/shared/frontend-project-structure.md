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
| HTTP transport and `/v1` calls | `apps/web/src/lib/http.ts` and `apps/web/src/lib/data/`. Screens import the data functions. See [client layers](../frontend/reference/client-layers.md) |
| Multi-step client sequences and pure helpers | `apps/web/src/lib/services/` and `apps/web/src/lib/utils/` |
| Session state, optional Firebase client | `apps/web/src/lib/auth.tsx` and `firebase.ts` |
| App styling and assets | `apps/web/src/styles/` and `apps/web/public/` |
| Reusable presentation and tokens | `packages/ui/` and `packages/theme/` |

Follow nearby patterns, [client layers](../frontend/reference/client-layers.md), and [pages and structure](../frontend/reference/pages-and-structure.md). Do not add `apps/web` controllers or a parallel `src/routes` or feature-folder framework to mirror the source toolkit. Public catalogs are server-rendered pages at `/packages`, `/services`, `/venues`, and their slug detail routes. Workspace screens are real `/app` paths, limited by the signed-in role. Catalog overlays remain inside `/app`. [Client data and auth](../frontend/reference/data-and-auth.md) distinguishes persisted flows from demo data.
