# Service summary cleanup

Started: 2026-11-22T10:08:00+08:00
Updated: 2026-11-22T10:16:51+08:00
Status: complete
Scope: Remove the duplicated additional-request and booking add-on copy from the details sidebar, request details, and prepare quotation. Keep editing on the booking.
Checkout: main at 4354f6cc with the presentation change in the working tree.
Continues: [Booking-owned add-ons](2026-11-22_05-12-21_booking-owned-add-ons.md)

## Goal

Each requested service appears once, as a name, an hour count, and a price. Catalog-term paragraphs and the quotation-page add-on editor are gone.

## Result

The read-only summary and the booking editor now share one row pattern. Prepare quotation keeps the priced lines only. Full rates stay in the edit dialog.

## Changes or findings

- `BookingIntake` no longer prints indicative catalog terms or a second add-on list. A service with an offer is one row: name, hours, computed amount.
- Request details drops that summary. Budget stays with the contact facts. `BookingOfferAddons` is the only service list there, with icon edit and remove controls.
- `QuotationComposer` no longer mounts the add-on editor. Each quoted service is a name, hours, and amount.
- A sent offer's line note is the hour count. Removal warnings stay. The customer delivery text still includes the agreed rate breakdown.

## Decisions

No business-rule change. Offers still own the price. An unpriced customer request remains a single "For review" row. An inquiry still does not confirm a booking.

## Verification

- `pnpm --filter @event-management/web test:proposal-status` passed, 26 tests. `booking-review.test.mjs` passed, 5 tests.
- ESLint passed on the edited components.
- A temporary local page rendered the sidebar, request list, and quotation rows with the app theme. Audio, florals, and decor showed ₱27,000, ₱19,000, and ₱19,400. Edit opened the existing price and hours dialog. The temporary page was removed.
- The signed-in messages drawer and admin booking page were not opened against a live session.

## Remaining work

None for this presentation pass. Hosted rollout is unchanged from the booking-owned add-on release.

## Resume here

Review the working-tree diff. Re-check the signed-in event details drawer if a local session is available.
