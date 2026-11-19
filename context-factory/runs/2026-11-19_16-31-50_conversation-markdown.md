# Conversation Markdown

Started: 2026-11-19T16:22:00+08:00
Updated: 2026-11-19T16:35:13+08:00
Status: complete
Scope: User authorized implementation after the read-only renderer investigation. No commit, push, deployment, database writes, or migration requested.
Checkout: main at 393a5e3d; unrelated background-job changes already dirty, including root README and the runs index.
Continues: [Instant conversation composer](2026-11-17_00-39-13_instant-conversation-composer.md)

## Goal

Render Markdown in guest, customer, and administrator conversation bubbles by reusing the catalog renderer, with safe presentation and preserved quotation cards and message controls.

## Result

The former `CatalogMarkdown` implementation now lives in the shared UI molecule `Markdown`. Catalog canvases, service descriptions, and the knowledge drawer use its document variant. PublicChat and MessagesWorkspace use its message variant. All current callers were migrated through the UI package export.

## Changes or findings

- Message styles inherit bubble colors and font size, preserve paragraph/list newlines, restore list markers, compact headings, wrap long links, and contain code/table overflow. Catalog clipping remains owned by the catalog widget.
- A message-only renderer hook removes the serializer's newline immediately after a hard-break element, preventing `pre-wrap` from displaying a second break. Ordinary newlines and document rendering remain unchanged.
- Both variants retain sanitization. Message images render alt text without fetching sender-supplied URLs; document images retain the existing behavior. This addresses the independent source review's tracking concern.
- Added renderer/workspace regression tests and stories for document, message, own-message, multiline, narrow overflow, and sanitized content. Quotations retain their separate exact-version card; no storage, API, permission, or composer changes.
- Root README records current behavior. Existing unrelated edits and run-index conflict markers were preserved.

## Verification

- Renderer/workspace/catalog SSR: 22/22 pass. Existing conversation helpers: 30/30 pass using the API workspace's `tsx` runner; plain Node could not load those TypeScript tests.
- UI/web type checks and final web/Storybook builds pass; builds retain the existing large-chunk warning. Scoped formatting and diff checks pass. Guidance fixtures pass 9/9.
- Browser: real components and app CSS with synthetic data at 390px and 1280px. Checked guest/customer/admin formatting, bubble colors, line breaks, list markers, wide code/links, quotation cards, customer/admin shortcuts, guest retry without duplicate bubbles, and image alt fallback. Hard and soft breaks both render two lines at the same measured height. No database or provider writes. The actual public service page also retains document Markdown, tables, and clipped catalog widgets without console errors.
- Luna independent source review identified the image-fetch concern; the fix and subsequent hard-break handling were reviewed with no remaining findings.
- Existing failures remain outside this diff: `check:web-structure` flags `use-thumbnail.ts`; `check:design` flags `ThumbnailField.tsx` and package-editor colors; `check:guidance` finds two already-missing image-related run records referenced inside existing run-index conflict markers. These files/markers were not repaired as part of Markdown work.

## Remaining work

No implementation work remains for this slice. Hosted behavior and live-provider output were not verified. Existing unrelated validation failures remain as listed above.

## Resume here

Inspect the scoped renderer/message diff and final evidence; preserve unrelated background-job work. No publication is authorized.
