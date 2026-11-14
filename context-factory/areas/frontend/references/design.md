# Clemora frontend design

**Important: every UI change follows the [mandatory package reuse workflow](../../packages/references/reuse.md#required-workflow-for-every-ui-change).** Load the frontend and packages skills and the required project structure and reuse references before editing, including for CSS-only, page-only, and mock UI changes.

Use the current [theme source](../../../../packages/theme/src/theme.css), [shared UI exports](../../../../packages/ui/src/index.ts), and the touched screen as the design baseline. `--cl-*` variables and the Clemora Tailwind tokens coexist with older wine/cream tokens used by prototype screens. Check consumers before replacing either set. Do not import another product's palette, fonts, tier badges, or billing conventions.

- Reuse existing presentation components from `@event-management/ui` and tokens from `@event-management/theme/theme.css`. Page-specific styles remain in `apps/web/src/styles/`; shared component classes remain in `packages/ui/src/styles.css`.
- Keep business decisions, fetching, authentication, and app navigation in `apps/web`. The current component library uses atomic layers and CSS classes. A design-skill suggestion does not establish a shadcn migration or a new token system.
- Follow existing assets and font loading in `apps/web/public/` and app styles. Load an applicable local design skill for a requested design task, then reconcile its suggestions with the existing code and approved direction.
- Build complete loading, empty, error, and success states. Use semantic elements, accessible names, keyboard focus, responsive layouts, and restrained motion consistent with the affected screen.
- Verify public and workspace consumers when shared UI changes. For catalog work, check the shared full-page preview, compact admin card, and editor modes separately. See [styling and verification](styling-and-verification.md) for the current layout details.

Load the full [frontend](../SKILL.md) and [packages](../../packages/SKILL.md) guidance for every UI change and complete the [reuse audit](../../packages/references/reuse.md#completion-audit) before delivery. Render affected states in the browser or Storybook; builds alone do not verify layout or interaction. UI text must reflect actual permissions and persistence, including the distinction between an inquiry and a confirmed booking.
