# Frontend structure in Clemora

[Astro configuration](../../apps/web/astro.config.mjs) and [web scripts](../../apps/web/package.json) host and build the frontend. Public pages are Astro documents; `/login` and `/app/*` mount [App.tsx](../../apps/web/src/components/app/App.tsx) as a React-only island. Within `/app`, [workspace-navigation.ts](../../apps/web/src/lib/workspace-navigation.ts) updates URL/history state and the mounted React app selects the role view. Public and login destinations remain document navigations.

| Responsibility | Current owner |
| --- | --- |
| Public Astro page routes | `apps/web/src/pages/` |
| Login and workspace document layout | `apps/web/src/layouts/WorkspaceDocument.astro` |
| View selection and app shell | `apps/web/src/components/app/` |
| `/app` URL and browser-history state | `apps/web/src/lib/workspace-navigation.ts` |
| Workspace panels | `apps/web/src/components/app/pages/` |
| Customer workspace | `apps/web/src/components/app/customer/` |
| Shared message workspace | `apps/web/src/components/app/messages/` |
| Public catalog sections | `apps/web/src/components/PublicCatalog.tsx`, `PublicServiceCatalog.tsx`, and app catalog components |
| HTTP transport and `/v1` calls | `apps/web/src/lib/http.ts` and `apps/web/src/lib/data/`. Screens import the data functions. See [client layers](../frontend/reference/client-layers.md) |
| Multi-step client sequences and pure helpers | `apps/web/src/lib/services/` and `apps/web/src/lib/utils/` |
| Session state, optional Firebase client | `apps/web/src/lib/auth.tsx` and `firebase.ts` |
| App styling and assets | `apps/web/src/styles/` and `apps/web/public/` |
| Reusable presentation, including catalog canvas and widget rendering, and tokens | `packages/ui/` and `packages/theme/` |

Follow nearby patterns, [client layers](../frontend/reference/client-layers.md), and [pages and structure](../frontend/reference/pages-and-structure.md). Do not add `apps/web` controllers or a parallel `src/routes` or feature-folder framework to mirror the source toolkit. Public catalogs are server-rendered pages at `/packages`, `/services`, `/venues`, and their slug detail routes. Workspace screens are real `/app` paths, limited by the signed-in role. Same-origin navigation within `/app` updates browser history without a document reload; login and public routes keep document navigation. Catalog overlays remain inside `/app`. [Client data and auth](../frontend/reference/data-and-auth.md) distinguishes persisted flows from demo data.
