# Theme, styles, and verification

- `packages/theme/src/theme.css` declares Tailwind theme values and CSS custom properties. The `--cl-*` tokens support Clemora's newer public style; the older wine/cream tokens still support prototype screens. Check consumers before replacing either set.
- `packages/ui/src/styles.css` owns shared component classes. Page-specific styling belongs in `apps/web/src/styles/`. The web CSS imports both theme and UI styles; Storybook imports them through its preview setup.
- Run `pnpm --filter @event-management/ui check` for component TypeScript and `pnpm build:storybook` for a static Storybook build when shared UI changes. `packages/theme` has no standalone check script, so verify a token change through the consuming web and Storybook builds.
- Inspect rendered component states in Storybook or the consuming page for visual changes. Check responsive and keyboard behavior where relevant; a type check is not a visual check.
