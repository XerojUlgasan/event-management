# Styling and verification

- `src/styles/app.css` styles the root React app and public catalog overlays, including `src/styles/public-catalog.css`. Shared tokens live in `packages/theme/src/theme.css`; shared component styles live in `packages/ui/src/styles.css`.
- The root workspace uses vendored images and fonts in `apps/web/public/`. Follow the touched page's existing asset and CSS pattern. Use semantic elements, accessible names, keyboard behavior, and responsive layouts when changing interactive UI.
- Run `pnpm --filter @event-management/web check` for Astro/TypeScript and `pnpm --filter @event-management/web build` for a production bundle. For changes to shared components, also run the package checks from the packages skill.
- For visible behavior or layout, inspect the actual page at the relevant route and viewport when a browser is available. A successful build alone cannot verify interaction, responsive layout, or login behavior. State what was and was not exercised.
