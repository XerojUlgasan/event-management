# @event-management/ui

Shared React presentation components for AMAC. Import public components from `src/index.ts` through `@event-management/ui`; shared component styles are exported as `@event-management/ui/styles.css`.

## Layers

- `atoms/` — primitives including `Button`, `Input`, `Textarea`, `Select`, `Badge`, `Icon`, `GoogleMark`, `Avatar`, `ActionLink`, `SectionCounter`, and `Wordmark`.
- `molecules/` — combinations including `Panel`, `StatCard`, `InputGroup`, `SearchField`, `Tabs`, `Pagination`, `FormField`, `ActivityList`, `Toast`, `NotificationProvider`, `Brand`, `SiteHeader`, and `InclusionStrip`.
- `organisms/` — larger reusable sections: `DataTable`, `PageHeader`, `Dialog`, `NativeDialog`, and `Drawer`.
- `templates/` — structural page layouts: `WorkspaceLayout`.

## Usage and ownership

```tsx
import { Button, Panel, PageHeader } from "@event-management/ui";
import "@event-management/ui/styles.css";
```

Use shared primitives for controls and presentation; application content, routing, data, and business logic stay in `apps/web/`. `Button`, `Input`, `Textarea`, and `Select` accept native element props and refs. The plain variants support controls embedded in specialized layouts. `NativeDialog` renders a native dialog and forwards its props and ref; the caller owns opening, closing, focus, and lifecycle behavior.

Shared component styles live in `src/styles.css`. Color choices and semantic surface, text, border, status, accent, and overlay tokens belong to `@event-management/theme`, including the existing AMAC and wine/cream tokens. App styles own page-specific layout.

`Button.pending` disables the action, exposes `aria-busy`, and displays the spinner; callers supply pending text and state. `variant="danger"` styles destructive confirmations. `IconName`, `BadgeTone`, and `ToastTone` describe supported values. `Toast` defaults to success/status feedback; danger feedback uses an alert and matching icon/color. `Toast` also supports informational status feedback. For app notifications, mount `NotificationProvider` once and call `useNotifications().notify(message, tone)`; the default tone is `success`. Use `notifyError(cause, fallback)` for failures: it formats an unknown error, emits the danger notice, and returns the same message for optional contextual text, such as `setError(notifyError(cause, "Unable to save."))`. Polling can use `notificationErrorMessage` to compare errors before notifying. The provider stacks messages, suppresses identical visible messages, and owns timers and cleanup. Success/info notices dismiss after six seconds, with timing paused during hover or keyboard focus; danger notices stay until dismissed. The shared host follows the active native dialog so notices remain visible and dismissible in modal flows. Standalone `Toast` callers still own its lifetime. `placement="inline"` renders a persistent notice in document flow, including server-rendered catalog errors and their retry links.

Mount `Dialog` and `Drawer` conditionally. Their native modal lifecycle handles background inertness and Escape requests; accepting `onClose` means unmounting the component. Ignoring a dismissal request keeps it open. Supply a title (`Drawer` requires one); an untitled `Dialog` needs `aria-label`. `Dialog.initialFocus` accepts a control ref for initial field focus. These wrappers restore focus to a connected opener. Specialized `NativeDialog` callers retain their own lifecycle.

`Tabs` defaults to filter-group buttons. For a true tablist, each item requires `id` and `panelId`; render matching labelled tab panels and hide inactive content. `PageHeader` supplies an `h1`, or `h2`/`h3` through `titleAs`; pass content rather than a heading element. Shared component dimension tokens retain the current appearance while centralizing control, radius, and field spacing values.

For fields with help or error feedback, `FormField` accepts `description`, `error`, and a render-function child that supplies the control's ID and accessibility attributes. Spread these props on the actual `Input`, `Select`, or `Textarea`; validation and state stay in the app. Existing node children retain their label-wrapper behavior. See the [AMAC UI reference](../../context-factory/areas/frontend/references/amac-ui.md) for composition examples.

## Storybook

`Pagination` is controlled by its caller. Supply the current `page`, whether a next page exists, and either previous/next callbacks or server-rendered `href` values. `pending` disables navigation while the requested page loads. The component does not fetch records or own cursors; `DataTable` renders only the rows it receives and does not include pagination.

`DataTable` takes typed `columns` (`key`, `header`, and `cell(row)`), `rows`, a stable `rowKey(row)`, and an accessible `label`. The first column supplies row headers and stays pinned during horizontal scrolling. The scroll region supports keyboard focus; `minWidth` defaults to 720px. Empty results keep the column headers and render `emptyMessage` inside the table. Callers own filtering, loading/error feedback, and cell actions. The booking staff table uses it for available responses. Its stories cover empty, populated, narrow, and long-name states.

```bash
pnpm --filter @event-management/ui storybook
pnpm build:storybook
```

Stories live alongside components. Follow the [Storybook authoring guide](STORYBOOK.md), use public package imports, and cover meaningful states. Stories illustrate components and do not replace interaction or browser verification.
