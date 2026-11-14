# Shared package ownership

**Important: package reuse is required for every UI change.** Read the [frontend](../../frontend/SKILL.md) and [packages](../SKILL.md) skills and the required project structure and reuse references before editing. This applies to public, admin, staff, and customer UI, including page-only components, CSS-only fixes, mock screens, and shared package changes. Deciding that no package file needs an edit does not skip this workflow.

## Existing owners

| Responsibility | Owner and inspection starting point | Supported consumption |
| --- | --- | --- |
| Reusable React presentation, component styles, and stories | [UI exports](../../../../packages/ui/src/index.ts), [package exports](../../../../packages/ui/package.json), [atomic layers](../../../../packages/ui/README.md), and the relevant component, story, and [styles](../../../../packages/ui/src/styles.css) | `@event-management/ui` and `@event-management/ui/styles.css` |
| Shared design tokens | [Theme source](../../../../packages/theme/src/theme.css) and [package exports](../../../../packages/theme/package.json) | `@event-management/theme/theme.css` and its existing CSS variables or Tailwind tokens |
| Shared catalog, filter and pagination types, domain limits, and event-day deadline policy | [Contract exports](../../../../packages/contracts/package.json) and the relevant source | `@event-management/contracts/catalog`, `@event-management/contracts/catalog-filters`, `@event-management/contracts/pagination`, the explicit `@event-management/contracts/limits/*` subpaths, and `@event-management/contracts/event-days` |

The web app loads theme and UI styles through [app.css](../../../../apps/web/src/styles/app.css); Storybook loads them through its [preview CSS](../../../../packages/ui/.storybook/preview.css). Check those consumers before changing shared styles. API schemas enforce accepted domain values; browser hints consume the shared limits, while server HTTP body caps remain in the API. Load the [limits skill](../../contracts/SKILL.md) when changing a mirrored constraint or its consumers.

## Required workflow for every UI change

1. **Inspect before editing.** Read the current exports and the matching component's implementation, props, stories, styles, and relevant theme tokens. Check the touched screen and other consumers. The export source is the inventory; a remembered list or a design-tool suggestion is insufficient.
2. **Reuse before adding.** Compose the existing public exports when they fit. Examples include `Button`, `Badge`, `Icon`, `FormField`, `Tabs`, `Pagination`, `PageHeader`, `Dialog`, `Drawer`, and `WorkspaceLayout`; verify their current props and behavior. Import through package exports rather than reaching into `packages/ui/src` from the app. Reuse shared contracts and constants instead of copying their shapes or values.
3. **Choose the owning layer.** Extend a shared component with a focused prop, variant, or composition when the missing capability belongs to its reusable responsibility. Put new reusable presentation in the appropriate atomic layer of `packages/ui`, export it through `src/index.ts`, keep its styles in the UI package, and add meaningful stories. Shared design values belong in `packages/theme`. Keep page-only content, layout composition, fetching, auth, navigation, and business decisions in `apps/web`; keep server operations and SQL in `apps/api`. Establish actual consumers before extracting a new abstraction.
4. **Resolve mismatches explicitly.** If no shared export fits, state the concrete semantic or behavioral gap and why composition or a scoped extension is unsuitable before introducing an app-local alternative. Ordinary semantic HTML and page layout do not need a new library component. Existing duplicate markup or hard-coded shared styles are not a pattern to copy. Keep any correction within the requested UI flow rather than starting an unrelated migration.
5. **Verify the owner and consumers.** Follow the [frontend checks](../../frontend/references/styling-and-verification.md) and, when UI or theme source changes, the [package checks](theme-and-verification.md). Inspect affected component states and consuming views, including relevant responsive and keyboard behavior. A shared change needs consumer evidence as well as Storybook coverage.

For example, compose a staff page action from exported `Button` and `Icon`, with availability state and page spacing owned by `apps/web`. Copying `Button.tsx` into `staff/` or duplicating its base styles in `app.css` bypasses the shared owner. If a missing button capability is reusable, extend the package component and its stories instead.

## Completion audit

Before delivering any UI change, inspect the final diff and confirm:

- The relevant current package exports, implementation, stories, styles, and tokens were checked; existing reusable components, contracts, and design values were used where applicable.
- Any new shared presentation, variant, or token lives with its owner; public exports and meaningful stories cover changed component APIs. App-specific behavior stays in the app, with a concrete reason for any local alternative to a shared primitive.
- App code uses public package imports and does not introduce a copied primitive, duplicated contract/limit, or duplicate shared base styles.
- Applicable checks passed and affected rendered states were inspected, or the missing proof is explicitly reported. Briefly identify reused or extended exports/tokens, any placement exception, and verification in the delivery.

This audit requires source and diff inspection. `pnpm check:guidance` validates guidance navigation and registration; it does not detect UI duplication or prove future agent compliance.

## Other shared code and new packages

For a new package, establish its consumers, ownership, exports, dependency direction, and verification first. State a routine placement choice and continue within the authorized task; ask only when the decision changes scope or a material requirement. Existing authorization does not need a second permission request solely because code is shared. Follow the [packages](../SKILL.md) and [limits](../../contracts/SKILL.md) guidance for their respective owners.
