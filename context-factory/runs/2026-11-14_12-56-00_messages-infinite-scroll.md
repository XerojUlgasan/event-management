# Messages infinite scroll

Started: 2026-11-14T12:44:00+08:00
Updated: 2026-11-14T12:56:00+08:00
Status: complete
Scope: Replace conversation page buttons and manual older-message loading with automatic scrolling for both customer and admin; preserve prior uncommitted Messages work
Checkout: main, edb7775; preceding context controls remain uncommitted
Continues: [Messages context controls](2026-11-14_12-42-00_messages-context-controls.md)

## Goal

Scrolling down the inbox appends conversations; scrolling up a thread prepends history without moving the message being read. Errors pause automatic loading until retried.

## Result

Both roles use a shared cursor accumulator and scroll-boundary observers. No Next/Previous or manual Load older controls remain in Messages. Loaded inbox rows survive polling; overlapping pages deduplicate by ID while preserving server order. Refresh bridges new activity until an unchanged row joins the known list. The existing missing-message gap reset and notice remain.

## Changes or findings

- [Inbox accumulation](../../apps/web/src/lib/services/messages/use-conversation-list.ts) owns polling, cursor retention, request guards, and distinct append errors. It composes the existing bounded API calls without changing their contracts.
- [MessagesWorkspace](../../apps/web/src/components/messages/MessagesWorkspace.tsx) observes its actual scroll containers, anchors a visible message before prepending, and follows ordinary arrivals only near the bottom.
- Customer deep-link retry and stale-selection protection remain coherent; sending requires the selected thread to be loaded. Older responses must match their conversation and requested cursor.
- Reuse audit: retained shared Button, notifications, and theme tokens. Scroll observation and cursor fetching belong to the app; no new shared UI primitive or package API was needed.

## Decisions

No backend, schema, permission, or fixture changes. Earlier package/details/quotation controls remain intact. Drafts retain their existing per-conversation behavior.

## Verification

- Web structure, frontend check (zero diagnostics), production build, and 19 focused message/quotation tests passed. Build retains its bundle-size warning.
- Real admin browser: accumulated 107 conversations through automatic pagination to the end; loaded rows survived polling. Original customer screen loaded its empty state.
- Isolated harness using the actual workspace, inbox hook, and merge helper: both roles, 60-row exhaustion, 45-message history, phone width, loading failure/retry without loops, and incoming-message reading position. A visible message moved less than 0.1px after prepend. This synthetic history proof is distinct from live API history.
- Terra source review findings were fixed and rechecked. Screenshots/harness remain in ignored `.scratch/messages-ui`. Fixture admin signed out; original customer cookies restored; temporary tabs closed and viewport reset. No messages were sent.
- Global design check still flags the two existing PublicDocument.astro/admin-event-days.css violations outside this scope.

## Remaining work

No requested implementation remains; changes are local and uncommitted.

## Resume here

Review this successor with its predecessor's scoped diff. Re-run focused tests through the API workspace's `tsx --test` runner when changing pagination or merging.
