# Pages and application structure

Astro serves public pages and mounts the React application for `/login` and `/app/*`. Inspect `apps/web/src/pages`, the Astro configuration, and `components/app/App.tsx` for current entry points. Same-origin workspace navigation uses `lib/navigation/workspace-navigation.ts`; public and login destinations use document navigation.

Page-specific composition and behavior belong in `apps/web`; shared presentation belongs in `@event-management/ui`. Follow [project structure](project-structure.md) and the [package reuse workflow](../../packages/references/reuse.md).

For a business journey, trace the actual page, data function, route, and persistence. The [business router](../../../business/README.md) describes intended responsibilities and the [product reference](../../../business/product.md#current-implementation) records current scope. A mock screen is not evidence of an implemented workflow.
