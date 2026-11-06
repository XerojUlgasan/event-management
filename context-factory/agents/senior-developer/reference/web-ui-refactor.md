# Whole-web UI refactor ledger

## Goal and boundary

Centralize reusable web presentation in `packages/ui` and authored colors in `packages/theme`. Reuse shared controls across the web while preserving existing interaction, accessibility, responsive layout, and application behavior. Keep specialized layout and business logic in the app. The starting checkout was branch `staff-page` at `5c0c8b4`; the pre-refactor web stylesheet snapshot is under `/tmp/clemora-whole-web-baseline-5c0c8b4/` when available. This temporary snapshot is not a repository dependency.

Preserve unrelated working-tree changes, including the existing `BookingList.tsx` changes and their semantics. Do not treat a component migration or build as proof of a persisted workflow.

## Integrated result

- Shared UI owns native-prop controls, button/link variants, fields and input groups, avatars, badges, panels, headers, keyboard tabs, `GoogleMark`, and lifecycle-neutral `NativeDialog`. The current source and `packages/ui/src/index.ts` are authoritative for exports. Native form submission, refs, file inputs, and dialog lifecycle remain with existing callers.
- Public/authentication, customer, staff, System Administrator, catalog/editor/preview, and demo workspace screens consume the shared presentation APIs. App styles retain page layout, content, specialized grids, and chart geometry. Obsolete local control rules were removed or narrowed.
- Web and shared UI authored colors use theme variables. Near-duplicate shades were consolidated into semantic surface, text, border, accent, status, and overlay tokens; exact pixel identity is not the acceptance criterion. Existing theme names and supplied media remain usable.
- `pnpm check:design` rejects native controls in web source, deep shared-package imports, and authored color literals in checked CSS/inline properties. It scans web/UI source, not media assets, and does not prove component fit, accessibility, or runtime behavior. Its negative fixture was checked with a raw button/color and its positive fixture with shared components/theme tokens.
- The working tree includes prior staff work, the existing booking-list rewrite, and concurrent contributor-guidance/shadcn work. Those changes were preserved. No dependency or shadcn migration is part of this refactor.

## Verification evidence (2026-11-06)

- Integrated `pnpm check`: 46 files, zero errors, warnings, or hints. `pnpm build` and `pnpm build:storybook` passed; bundle-size warnings remain. `pnpm check:design`, `pnpm check:guidance`, and `git diff --check` passed after integration.
- Independent source review covered shared component contracts and consumers. Its catalog search minimum-width finding was fixed; follow-up found no actionable findings. Final browser checks confirmed the shared PageHeader layout, mobile Sign in visibility, shared staff textarea, and arrow-key catalog tabs.
- Browser checks used the production build served temporarily on the local frontend origin, with desktop and 320px mobile layouts. Public catalogs, package previews, booking-request validation and conditional fields, nested modal Escape behavior, auth mode/password controls, catalog search/archive tabs, editor Markdown preview, photo settings, and file chooser opening were exercised. Unsaved editor changes were discarded. Administrator booking-request details, services, venues, and messages were inspected through live reads.
- Customer Home, My Events, Messages, and Account settings, coordinator checklist editing, and ordinary-staff navigation were rendered using API-verified role response fixtures. Four separate fixture sessions were authenticated and `/me` checked; customer-owned request/conversation reads were also checked. This verifies the selected role presentation, not a complete live browser authentication or persistence journey for every role. Staff event/checklist changes remain demo state.
- Final mobile catalog and auth layouts had no horizontal overflow. The final browser console check found no TypeError, ReferenceError, hydration error, or null-property access in captured errors. Screenshots were saved outside the repo in the task visualization directory.
- No catalog save, booking submission, message send, or media upload was performed. Opening the file chooser does not prove storage upload. Production Firebase, external storage, and every possible screen/state were not exercised by this presentation refactor.
- The temporary served build and browser tab were removed, and all four API QA sessions were logged out (204). The user's browser session was preserved.

## Component contracts follow-up (2026-11-06)

The component-by-component improvement follows the [Clemora UI skill](../../../frontend/clemora-ui/SKILL.md). It strengthens the existing React/CSS library and its consumers; it does not introduce a shadcn dependency migration. Earlier evidence above belongs to the original migration and is not a claim about this follow-up.

| Component | Change and consumer evidence |
| --- | --- |
| `Dialog` | Mounted native modal lifecycle, title/intro associations including rich titles, guarded Escape/backdrop dismissal, initial field focus, and explicit opener restoration. The customer message field uses `initialFocus`; catalog action menus focus their visible summary before opening confirmations. |
| `Drawer` | Same native modal lifecycle with a required heading and optional status slot. Calendar, inventory, staff, and customer detail callers use the shared title API. |
| `NativeDialog` | Specialized preview/editor/booking callers keep their existing lifecycle contract. Public package preview → booking validation → Escape back to preview was checked. |
| `Tabs` | Filter groups expose pressed state and accessible labels. Catalog switches now use this mode; the earlier arrow-key catalog evidence above predates that semantic correction. True tablists require item IDs/panel IDs and provide horizontal Arrow/Home/End navigation, skipping disabled choices. The story renders the matching panels. |
| `Button` | Shared pending/disabled/busy presentation and a danger variant, adopted by service/venue confirmation actions. The app still owns async operations and pending text. |
| `Input`, `Select`, `Textarea`, `InputGroup` | Shared invalid, disabled, and read-only styles where native controls support those states. Grouped plain inputs show their invalid border; focused invalid controls retain it. Native props and refs remain forwarded. |
| `Icon`, `Badge` | Public supported-value types, a working spinner asset, reduced-motion styling, and complete galleries (26 icons, nine badge tones). Dynamic callers retain literal types. |
| `Toast` | Success/status and danger/alert feedback. The actual customer new-chat error uses danger. Customer and inventory callers replace prior timers and clean up on unmount, preserving notification durations. |
| `PageHeader` | An `h1` by default and `h2`/`h3` through `titleAs`. Four callers pass content instead of nested headings. |
| Theme | Existing shared radius, control height/padding/type size, and field gap values have a shared token owner. The current public/workspace palettes remain the design baseline. |
| Existing compositions | `Panel`, `SearchField`, and `WorkspaceLayout` contracts fit the inspected consumers. Continue composing them through public exports; no extra wrapper was needed. The earlier `FormField` help/error contract was regression-checked through native controls and booking validation. |

The modal decision compared a shared native lifecycle with custom focus management and a new primitive dependency. Native behavior fits current callers and delegates background inertness and modal focus behavior to the browser. The small private `ModalSurface` owns mounted opening/cleanup; dismissal remains an app decision so busy callbacks can refuse it. Lifecycle-neutral `NativeDialog` continues to serve specialized flows. App validation, navigation, fetching, permissions, and persistence were not moved into UI.

Verification for this follow-up:

- `pnpm check`, `pnpm build`, `pnpm build:storybook`, `pnpm check:design` (90 source files), `pnpm check:guidance`, skill metadata validation, and `git diff --check` passed. Build chunk-size warnings remain. Independent Sol source review found no actionable regressions; Terra implemented the bounded icon/badge, heading, and notification-caller units, which the lead integrated and checked.
- Browser checks used Chromium, interactive Storybook, and isolated production web builds with local response fixtures for public, customer, and administrator views. Fixtures reject every write. Native modal naming, rich titles, focus entry/return, customer textarea initial focus, Escape, inside/backdrop clicks, drag-out handling, busy dismissal refusal, drawer-to-dialog handoff, and reopening were exercised. Tab panel relationships and Arrow/Home/End behavior were checked, including disabled items; catalog filter switching and Tab reachability were checked separately.
- At emulated 320px/390px widths, checked modal/control states had no horizontal overflow. Long dialog content and a drawer on a short viewport scrolled to their final actions. Pending button semantics, reduced-motion spinner behavior, invalid/disabled/read-only controls, grouped error association, complete galleries, and a customer failure toast were inspected. A mobile customer-dialog screenshot was saved outside the repo as a review artifact.
- Notification timer replacement/cleanup was source-reviewed; exact overlapping timer deadlines were not timed in the browser. No live authentication, database persistence, successful message send, booking submission, catalog mutation, storage operation, physical mobile keyboard, screen reader, or other browser engine was verified in this follow-up.
- Impeccable's static file scan reported the existing thick border on `.stat-card.attention`; that rule was already present in the task baseline. Its regex scan does not run parsed contrast or tiny-text rules. Captured browser logs had no TypeError, ReferenceError, InvalidStateError, hydration, or null-property exception in the tested views.

Contributor guidance and Storybook authoring notes now describe the changed APIs. Page-only, shared-component, CSS/token, and shadcn-setup routing still leads through the frontend/packages skills and their owning references. Root product scope and paper material need no change for these presentation contracts.
