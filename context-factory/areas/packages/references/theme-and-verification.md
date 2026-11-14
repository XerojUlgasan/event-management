# Theme, styles, and verification

- `packages/theme/src/theme.css` declares Tailwind theme values and CSS custom properties. Both `--cl-*` and older wine/cream names resolve to the Styled by AMAC palette. Check consumers before replacing either set. The original logo is imported from `packages/ui/src/assets/` by shared branding components; their CSS clips its blank padding while preserving all artwork. See the [web design record](../../../../apps/web/DESIGN.md).
- `packages/ui/src/styles.css` owns shared component classes. Page-specific styling belongs in `apps/web/src/styles/`. The web CSS imports both theme and UI styles; Storybook imports them through its preview setup.
- Run `pnpm --filter @event-management/ui check` for component TypeScript and `pnpm build:storybook` for a static Storybook build when shared UI changes. `packages/theme` has no standalone check script, so verify a token change through the consuming web and Storybook builds.
- Inspect rendered component states in Storybook or the consuming page for visual changes. Check responsive and keyboard behavior where relevant; a type check is not a visual check.
