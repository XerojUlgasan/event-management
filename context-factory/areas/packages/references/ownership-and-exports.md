# Ownership and exports

- `packages/ui` is the reusable React component library. Its `src/index.ts` is the public component export surface, including the controlled `Pagination` component; `package.json` exposes that entry and `./styles.css`.
- App consumers import public components from `@event-management/ui`; do not deep-import its source files or copy a primitive into the app. Apply the [mandatory reuse workflow](reuse.md#required-workflow-for-every-ui-change) even when no package file changes.
- `src/atoms/` contains small primitives; `molecules/` combines them; `organisms/` holds larger reusable sections; `templates/` provides shared layout structure. The README in each layer describes its intent. Place a component by its actual reuse and responsibility, not merely its visual size.
- Keep app routing, data fetching, auth state, business rules, and page-only content in `apps/web/`, following the [frontend structure contract](../../frontend/references/project-structure.md). Move UI into `packages/ui` when a reusable presentation need is established; update `src/index.ts` if it should be public.
- `packages/theme` exports `./theme.css` and owns shared design tokens. It has no React components. Inspect both its `package.json` and the importing styles before changing token names.
- `packages/contracts` exposes package/service catalog types through `@event-management/contracts/catalog`, shared pagination types and page-size constants through `@event-management/contracts/pagination`, and shared domain limits through explicit `@event-management/contracts/limits/*` subpath exports. Reuse those exports rather than duplicating shapes or values. These contracts are separate from UI components and theme tokens; see the [shared limits guidance](../../contracts/SKILL.md).

Quotation item/terms/response types and shared quotation limits are exported through `@event-management/contracts/quotations`. The API parses HTTP and persisted JSON; the browser imports these types without treating TypeScript assertions as validation.

The reusable `DateSelect` is exported from `@event-management/ui`; it composes shared Button/Select controls as a five-row scrolling long-date dropdown, initially centered on its supplied date, with keyboard selection and focus restoration. Its stories cover interaction, requested dates and disabled controls.
