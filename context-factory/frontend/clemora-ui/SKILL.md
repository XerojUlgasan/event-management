---
name: clemora-ui
description: Choose, compose, style, or extend Clemora's shared UI components and their Storybook stories for a frontend task.
---

# Use the shared Clemora UI

This usage guide supplements the [frontend](../SKILL.md) and [packages](../../packages/SKILL.md) skills and their required references. The [package reuse workflow](../../shared/shared-packages.md) owns placement and the completion audit for every UI change.

## Inspect and compose

1. Inspect [public exports](../../../packages/ui/src/index.ts), [package exports](../../../packages/ui/package.json), the relevant implementation and colocated stories, its styles, theme tokens, and actual app callers. Use current source as the authority for props and behavior.
2. Import app components from `@event-management/ui`, not package source paths. The public component entry is the root export; the stylesheet is `@event-management/ui/styles.css`.
3. Compose existing components when they fit. `Input`, `Select`, and `Textarea` forward native props and refs; `InputGroup` supplies a container with optional leading and trailing content. `Panel` supplies a reusable surface and optional header. Ordinary semantic HTML remains appropriate for content and page layout.
4. For a field with help or error text, use the `FormField` render function and spread its provided props on the control to associate its label and messages. `htmlFor` supplies the control ID when provided; otherwise the render function receives an automatically generated ID. Existing node children remain supported and own their own control and message associations.
5. `Tabs` accepts items, active value, and a change handler. Filter buttons use the default `role="group"`, an accessible label, and `aria-pressed`; current catalog switches are filters. A true `role="tablist"` requires each item's `id` and `panelId`. Render matching `role="tabpanel"` elements with `id={item.panelId}` and `aria-labelledby={item.id}`; hide inactive panels. Tabs supplies horizontal Arrow, Home, and End navigation, skips disabled items, and keeps one enabled tab in the tab order. The app owns selection and panel content; see the [interactive tab story](../../../packages/ui/src/molecules/Tabs.stories.tsx).
6. Mount `Dialog` or `Drawer` conditionally while open. They use native modal behavior, name themselves from their title, request dismissal through `onClose` for Escape, backdrop clicks, and the close button, and restore focus to a connected opener. Remove the component when accepting dismissal; an ignored request leaves it open, including busy confirmations. `Drawer` requires a `title` and accepts a `status` slot before it. Give `Dialog` a `title` or an explicit `aria-label`; its optional `intro` supplies the accessible description. Use `Dialog.initialFocus` with a control ref when a specific field should receive focus on opening, as in the customer message dialog. Keep a visible opener available: catalog menus focus their summary before opening a modal.
7. `NativeDialog` remains a lifecycle-neutral native element with forwarded props and a ref. Use it for existing specialized editor, preview, and booking flows that already coordinate app state, `showModal()`, closing, cancel handling, and focus. Do not mix that caller-owned lifecycle with mounted `Dialog`/`Drawer` behavior.

Choose the local API rather than a similarly named upstream component:

| Need | Existing composition |
| --- | --- |
| Action | `Button` with its `variant`, `size`, and native props. Its default type is `button`; form submission uses `type="submit"`. `pending` supplies a spinner, `aria-busy`, and native disabling; the app supplies pending text/state. Use `variant="danger"` for destructive confirmation actions. |
| Field feedback | `FormField` with `description`, `error`, and a render-function child using `Input`, `Select`, or `Textarea`. |
| Adorned control or search | `InputGroup` with `leading`/`trailing` content, or `SearchField` for the existing search interaction. |
| Surface or workspace structure | `Panel`, `PageHeader`, and `WorkspaceLayout`; page navigation and content stay in the app. `PageHeader` supplies an `h1` by default, with `titleAs="h2"`/`"h3"` for nested sections. Pass heading content, not another heading element. |
| Status and icons | `Badge.tone` uses exported `BadgeTone`; `Icon.name`, `Button.icon`, and `Toast.icon` use exported `IconName`. The spinner icon respects reduced motion. Icon-only buttons need an accessible name. |
| Monthly date counts and filtering | `MonthCalendar` receives `month` as `YYYY-MM`, optional date-keyed `counts`, `selectedDate`, and change callbacks. The app owns count aggregation, fetching, date toggling, selected-date reset, and domain labels. Staff use operational event-day dates; booking views use every requested date, with `preferred_date` fallback for legacy requests. It renders a date filter rather than an event scheduler. |
| Loading, empty, or error feedback | Use `Toast` for brief success (`tone="success"`, status) or failure (`tone="danger"`, alert) feedback. Its caller owns timing and cleanup. Keep form errors inline and reuse established empty/loading compositions; the library does not export `Alert`, `Empty`, or `Skeleton`. |

For example, let the app supply submission and validation feedback:

```tsx
import type { ComponentProps } from "react";
import { Button, FormField, Input } from "@event-management/ui";

export function ContactForm({ onSubmit, nameError }: {
  onSubmit: ComponentProps<"form">["onSubmit"];
  nameError?: string;
}) {
  return (
    <form onSubmit={onSubmit}>
      <FormField label="Contact name" description="Who should staff contact?" error={nameError}>
        {(field) => <Input {...field} name="contactName" autoComplete="name" required />}
      </FormField>
      <Button type="submit">Review details</Button>
    </form>
  );
}
```

The render function supplies the control ID, label association, invalid state, and description/error IDs. Spread them on the actual control, including inside an `InputGroup`; compose any additional `aria-describedby` IDs with the supplied value. Keep validation, touched state, pending state, and persistence in the app. See the [booking-request caller](../../../apps/web/src/components/app/BookingRequest.tsx) and [field stories](../../../packages/ui/src/molecules/FormField.stories.tsx).

## Ownership and styling

Reusable presentation belongs in `packages/ui/src/atoms`, `molecules`, `organisms`, or `templates` according to its responsibility. Export public components from `packages/ui/src/index.ts`, keep shared component styles in `packages/ui/src/styles.css`, and add meaningful colocated stories using the [Storybook guide](../../../packages/ui/STORYBOOK.md). Keep routing, data fetching, authentication, business rules, and page-specific composition in `apps/web`. Use shared types and limits from their existing `@event-management/contracts` exports.

Use existing component variants and CSS variables from [theme.css](../../../packages/theme/src/theme.css); place shared tokens in `packages/theme`. Page styles own local layout. The theme contains both `--cl-*` values for the newer public design and wine/cream values used by existing workspace screens. The web app imports theme and UI styles in [app.css](../../../apps/web/src/styles/app.css); its base fonts are DM Sans and Playfair Display, while the newer public styling also defines the Clemora font stack. Inspect the touched screen before changing its typography or colors.

Shared radius, control height/padding/type size, and field-gap variables capture the current workspace dimensions. Reuse them when extending a matching control; a token extraction does not establish a new visual direction. Native disabled/read-only controls and invalid controls, including plain controls inside `InputGroup`, have shared state styles.

Prefer a component's existing variant and size to a local visual override. Use shared semantic variables such as `--surface-base`, `--text-primary`, `--border-default`, and `--status-danger-text`. The `plain` controls support established specialized compositions; inspect their callers before choosing them. Inside the UI implementation, follow the current relative-import and class-composition patterns. Only the root and stylesheet are public exports; there are no component subpaths or exported `cn()` helper.

For actual shadcn setup or registry work, read [Clemora's integration notes](../../packages/reference/shadcn.md), then the installed [shadcn skill](../../../.agents/skills/shadcn/SKILL.md). The current Clemora components have their own APIs; do not assume upstream component contracts or initialized configuration.

## Verify

From the repository root, choose checks for the affected work:

```sh
pnpm --filter @event-management/ui check
pnpm build:storybook
pnpm --filter @event-management/web check
pnpm --filter @event-management/web build
pnpm check:design
```

Inspect changed states in Storybook and consuming views when available, including relevant keyboard, focus, error, and narrow viewport behavior. A build or source check does not prove a rendered journey. Check the active environment before starting services and report any missing browser evidence. Complete the [reuse audit](../../shared/shared-packages.md#completion-audit).

When this skill or its routing changes, also run `pnpm check:guidance` and validate its metadata with the skill-creator validator. Walk page-only, shared-component, CSS/token, and shadcn-setup requests through the links; a navigation check alone cannot verify those decisions.
