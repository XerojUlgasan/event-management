# Messages context controls

Started: 2026-11-14T12:42:00+08:00
Updated: 2026-11-14T12:42:00+08:00
Status: complete
Scope: Implement the approved warm Messages revision for customer and admin; separate Details, Current package, and latest sent Quotation. Preserve exact quotation-message versions and existing permissions.
Checkout: main, edb7775; clean before this task, scoped changes uncommitted
Continues: none

## Goal

Replace the repeated booking-summary interaction with useful, distinct views. The user explicitly approved real-screen implementation and latest sent quotation only after reviewing the scratch proposal.

## Result

Both linked conversation headers now expose labeled icon controls. Details is a read-only event/contact/date drawer with role-specific management navigation. Current package uses the existing full preview, including the private custom package, without starting another booking. Quotation shows the latest actually sent version; message cards still open their linked version.

## Changes or findings

- Reuse audit: retained shared Drawer, Dialog, NativeDialog, Button, Textarea, Icon, Badge, notifications, theme tokens, PackagePreview/PackageCanvas, and QuotationSummaryRead. No new UI primitives or API contracts.
- Added [ConversationContext](../../apps/web/src/components/messages/ConversationContext.tsx) and a paginated [latest sent lookup](../../apps/web/src/lib/services/quotations/latest-sent-quotation.ts). Unsent superseded revisions are excluded; a sent superseded offer remains readable during revision.
- Polished the inbox, quotation cards, event context, phone navigation, and multiline composer. Drafts and pending sends are scoped by conversation; switching chats cannot duplicate an in-flight send.

## Decisions

Real screens were authorized. Quotation means latest sent only. Management remains in My events or the admin booking workspace. No schema, permissions, booking status, or offer mutations were needed.

## Verification

- Web structure, frontend check (zero diagnostics), production build, 11 focused quotation/message tests, and catalog regression tests passed. Build retains its bundle-size warning.
- Local browser fixtures: both roles' details and custom preview; latest sent v2 versus exact historical v1; empty offer; general-chat omission; phone layout and tablet Back. Deferred-send harness verified draft preservation and duplicate prevention without sending API messages.
- Independent Terra source review findings were fixed and rechecked. One real-source Impeccable scan returned `[]` before final mobile refinements. No overlays were injected. Screenshots/harness remain in ignored `.scratch/messages-ui`; temporary authentication files were removed, task sessions revoked, original browser session restored.
- Global design check still reports pre-existing violations in PublicDocument.astro and admin-event-days.css. Browser evidence establishes local fixture behavior, not production or human usability.

## Remaining work

No requested implementation remains. Review or commit when requested; changes are not deployed.

## Resume here

Inspect the scoped diff and [README implementation](../../README.md#booking-requests-and-messages). Do not reset fixtures or expand the feature scope without a new request.
