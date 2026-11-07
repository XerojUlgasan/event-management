# Private booking packages verification

Verified on 2026-11-07 against the working tree based on `b1ee3dd`, including the existing uncommitted booking-simplification work. This is an implementation evidence record; the root [README](../../../../README.md#booking-requests-and-messages) owns current product behavior.

## Requirements and evidence

| Requirement | Evidence |
| --- | --- |
| Existing package system, one private package per booking, preserved history | The new [migration](../../../../apps/api/prisma/migrations/20261107180000_private_booking_packages/migration.sql) and [migration test](../../../../apps/api/tests/private-custom-packages-migration.test.ts) preserve existing package/publication values, booking rows, conversations/messages, audit history, quotation amounts and adjustments. Type/owner/publication checks, unique ownership, immutable ownership, and cross-booking selection are exercised against PostgreSQL. Legacy quotation terms remain null. |
| Create and replace atomically; edit in place | Booking-scoped GET/POST/PUT [controllers](../../../../apps/api/src/controllers/booking-requests/custom-package.ts) and [service](../../../../apps/api/src/services/booking-requests/custom-package.ts) use booking/package versions, transactions, audit events and conversation timestamps. The package suite proves duplicate concurrent POSTs and concurrent PUTs have one winner, stale/archived/closed inputs fail, invalid media rolls back replacement, and reload retains winning content. |
| Package and media privacy on alternate paths | The [package suite](../../../../apps/api/tests/packages.test.ts) checks public/admin catalog exclusion, public detail and inquiry rejection, customer ownership, staff field redaction, message ownership, private streaming and private cache rules. Live API checks and browser checks independently confirmed denied other-customer, staff and signed-out access. Staff retain event details with null package price/capacity and no private package controls. |
| Independent uploaded photo/video copies and cleanup | Fake-storage tests check source isolation, failed staging, transaction cleanup, retained quotation media, stale cleanup, and rejection of cross-package reuse. Actual configured R2 checks separately proved independent JPEG and valid MP4 copies, equal bytes, private cache headers, video byte ranges, and retained quotation video after removal from both the private canvas and original source. Provider-failure injection remains local fake-storage evidence. |
| Offered terms and customer reapproval | The [quotation suite](../../../../apps/api/tests/quotations.test.ts) covers immutable package/delivery terms, assigned-service revisions, legacy unknown history, stale send/accept rejection, explicit adjustment review, preserved amounts, and fresh acceptance after revision. Browser admin checks exercised a price change, rejected stale send, refresh, revision with the new base, adjustment review and successful send. Customer quote delivery in chat remains deferred. |
| Existing editor and booking structure | Browser checks exercised Overview/Quotation/Status, editable package metadata and Markdown, copied uploaded photo, Save & replace, reload, later edits, a competing-tab conflict and refresh. The owner preview is read-only and Message the team opens the correct linked conversation with current package context. |
| Cancellation, focus and mobile | Browser checks exercised unsaved discard, Escape dismissal of the shared confirmation, Tab containment, return to the initiating editor button, mobile reorder/discard, and desktop/mobile previews. Admin, owner and unrelated-customer views were checked at desktop and 390px mobile widths. Private photo loading was observed in the owning customer's browser. |
| Shared contracts and guidance | [Catalog contracts](../../../../packages/contracts/src/catalog.ts), OpenAPI schemas, browser DTOs/calls and generated Kysely types were updated together. README and API/frontend/media/migration/limits/QA guidance were checked against current source. |

## Checks

The following passed on the integrated implementation:

```sh
pnpm db:validate
pnpm check
pnpm build
pnpm check:guidance
pnpm --filter @event-management/api exec tsx --test tests/packages.test.ts tests/booking-requests.test.ts tests/messages.test.ts tests/quotations.test.ts tests/private-custom-packages-migration.test.ts tests/booking-simplification-migration.test.ts
git diff --check
```

The combined behavior/migration run passed 39 tests with no skips. The web build reports a Vite warning about chunks over 500 kB; it completes successfully. Shared UI/theme source was reused without changing its public components.

The local populated database was backed up before applying the new migration. The recorded migration checksum matches its current source. No database reset or historical migration rewrite was used. Synthetic live checks used documented development accounts; no credentials, cookie values, fixture IDs, or provider configuration are retained here.

## Lasting integration lessons

- Quotation snapshots are live media references for retention and authorization. Counting only current canvas widgets would delete offered history or make previously private bytes reusable elsewhere.
- Lock assigned services while validating availability and quotation terms. A package timestamp alone cannot detect a separately changed service.
- Capture the initiating button before disabling it for an asynchronous load. An editor mounted afterward may otherwise capture the document body as its focus target.
- The relevant integration suites share a [database teardown helper](../../../../apps/api/tests/helpers/drop-test-database.ts). `pg-pool.end()` can resolve before PostgreSQL has observed socket closure; waiting for the exact isolated database's connections avoids forced-drop errors without suppressing failures.

These checks establish the local application and configured R2 paths exercised here. They do not establish a hosted deployment, production Firebase behavior, quotation delivery to customers through chat, booking confirmation, availability or payments.
