# Ownership and exports

- `packages/ui` is the reusable React component library. Its `src/index.ts` is the public component export surface; `package.json` exposes that entry and `./styles.css`.
- `src/atoms/` contains small primitives; `molecules/` combines them; `organisms/` holds larger reusable sections; `templates/` provides shared layout structure. The README in each layer describes its intent. Place a component by its actual reuse and responsibility, not merely its visual size.
- Keep app routing, data fetching, auth state, business rules, and page-only content in `apps/web/`. Move UI into `packages/ui` when a reusable presentation need is established; update `src/index.ts` if it should be public.
- `packages/theme` exports `./theme.css` and owns shared design tokens. It has no React components. Inspect both its `package.json` and the importing styles before changing token names.
