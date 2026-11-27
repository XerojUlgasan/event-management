# Customer events timeline

Started: 2026-11-14T11:37:51+08:00
Updated: 2026-11-14T11:50:00+08:00
Status: complete
Scope: Improve customer My events using the supplied grouped timeline reference, preserve the existing design and request semantics, delegate investigation, and inspect/refine usability. No deployment, migrations, resets, or shared-data writes.
Checkout: main, baseline 5fb0b9c; existing catalog/guidance changes preserved; work remains uncommitted.
Continues: none

## Goal

Make requested dates and next actions easier to find, inspect desktop/mobile states, and refine unnecessary or confusing UI.

## Result

Implemented a compact timeline with Today, Upcoming, Dates to arrange, Past dates, and Closed requests. Cards show dates, saved times, status, reference, details, and chat. Details retain operational schedules, time editing, history, quotations, and cancellation. Empty groups are omitted except Upcoming; the fully empty page offers a package-browsing entry point.

## Changes or findings

- Reused PageHeader, Button, Icon, BookingStatusBadge/Badge, existing details/NativeDialog, and theme tokens. New article/date-tile layout stays in booking-request app composition and scoped CSS; no shared component API or palette changes.
- Grouping uses each request's timezone and next requested date, accounting for nonconsecutive days and legacy dates. It describes requests, not confirmed bookings or operational progress.
- Earlier creation-ordered API pages accumulate without duplicates. Loaded-count wording discloses that additional upcoming dates may remain unloaded.
- Independent review identified a delayed-save/cancellation race; revision and terminal-status guards now reject stale updates. Mobile inspection led to full-width schedule/actions and wrapping long event types at 320px.

## Verification

- `pnpm check`, web build, structure, formatting, and diff checks passed. Date/grouping/race/navigation tests passed 15/15. Impeccable detector returned no findings.
- Browser: real local session/Edge API empty state and catalog navigation; synthetic intercepted responses for populated groups, loading, initial/load-more errors and retries, append/deduplication, details/history, cancellation disclosure, closed controls, chat routing, focus restoration, and long content. Captures inspected at 1440, 622, 390, and 320 CSS pixels. Interception and viewport overrides cleared; no test records or messages created.
- Sol source/screenshot review: ship after the 320px overflow fix and settled-page recapture. Terra investigated behavior/reviewed source; Luna audited reuse and added pure tests. This does not establish human usability or production behavior.
- `pnpm check:design` retains two baseline failures: raw input in `PublicDocument.astro:29` and literal transparent in `admin-event-days.css:72`.
- Guidance check and 9/9 guidance tests passed; applicable UI, TypeScript, documentation, and continuation routing scenarios were walked. README documents the timeline boundary; Luna's final documentation/reuse audit found no shared primitive duplication or design-system replacement.

## Remaining work

No requested implementation remains. Human usability studies and production behavior were not tested. Additional upcoming requests may require loading earlier creation-ordered pages; the UI states this limitation.

## Resume here

Review the scoped uncommitted timeline changes starting at `CustomerEventTimeline.tsx` and `BookingList.tsx`; commit or deploy only when requested.
