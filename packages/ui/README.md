# @event-management/ui

Shared design system for the Clemora apps. Components are grouped by atomic layer and exported from `src/index.ts`.

## Layers

- `atoms/` — basic elements: `Button`, `Badge`, `Icon`, `Avatar`, `ActionLink`, `SectionCounter`, `Wordmark`.
- `molecules/` — combinations of atoms: `Panel`, `StatCard`, `SearchField`, `Tabs`, `FormField`, `ActivityList`, `Toast`, `Brand`, `SiteHeader`, `InclusionStrip`.
- `organisms/` — larger reusable sections: `PageHeader`, `Dialog`, `Drawer`.
- `templates/` — structural page layouts: `WorkspaceLayout`.

## Usage

```tsx
import { Button, Panel, PageHeader } from "@event-management/ui";
import "@event-management/ui/styles.css";
```

Application content, routing, data, and business logic stay in `apps/web/`. Components that are only used by a single page are kept there rather than promoted to this package. Shared visual styles live in `src/styles.css` and consume the design tokens from `@event-management/theme`.

## Storybook

```bash
pnpm --filter @event-management/ui storybook
pnpm build:storybook
```

Every layer has stories alongside its components.
