# Storybook authoring

Stories document and exercise the public presentation API. Storybook discovers `src/**/*.stories.ts(x)`; place each story beside its component and use realistic, non-sensitive content. Import public components from `@event-management/ui`, and check the current export and component implementation before writing examples.

Cover meaningful variants and observable states, including disabled, empty, error, and interactive states when relevant. Use local React state for interaction; keep routing, fetching, persistence, permissions, and business rules in the app. Include a narrow container where responsive layout matters. Use the shared theme and styles already loaded by `.storybook/preview.css`.

For example, the render-function form of `FormField` connects the label and messages to the control:

```tsx
import { FormField, Input } from "@event-management/ui";

<FormField label="Contact name" description="Use the name staff should ask for." error="Enter a contact name.">
  {(controlProps) => <Input {...controlProps} name="contactName" />}
</FormField>
```

Include a legacy node-child example when changing `FormField`: its existing label wrapper remains supported, and callers own any help and error associations in that form. Use shared controls in stories when they fit, and exercise both help and error together when their association changes.

Modal stories need a trigger, local open state, and an `onClose` that unmounts the modal so Escape, backdrop dismissal, reopening, and returning focus can be checked. Include guarded dismissal, a rich title, initial field focus, and long content. Keep `NativeDialog` examples explicit about caller-owned lifecycle. A tablist example must render its labelled panels; filter groups should show pressed state. Cover pending/destructive buttons, invalid/disabled/read-only controls, complete supported icon/badge values, and error/long-message toasts when changing these contracts.

Run from the repository root:

```sh
pnpm --filter @event-management/ui check
pnpm build:storybook
```

To inspect interactively when appropriate, run `pnpm storybook` after checking the environment. A successful static build shows that stories bundle; inspect rendered states, focus and keyboard behavior, and affected app views separately. For web changes also follow the [frontend verification guidance](../../context-factory/frontend/reference/styling-and-verification.md) and run `pnpm check:design`.
