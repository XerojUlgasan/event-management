# Manual booking add-ons

Started: 2026-11-22T01:16:37+08:00
Updated: 2026-11-22T04:16:14+08:00
Status: complete
Scope: Implement optional catalog service requests and hours in the manual booking form.
Checkout: main at 67253d24 with pre-existing conversational booking and other working-tree changes.
Continues: [Single-row conversational booking](2026-11-22_00-39-41_single-row-booking-drafts.md)

## Result

The public package action opens the manual booking form before sign-in. Customers can choose optional services, enter excess hours for fixed-price services or total hours for hourly services, and review the rows before submitting. The same form serves manual booking from Messages with or without a package. The form preserves selections through sign-in and offers an explicit refresh when catalog terms change. Services already included in the selected package are ineligible.

The API resolves current catalog terms in the booking transaction. The booking retains requested coverage and a snapshot of the catalog terms for customer and admin review. The team chooses the services and billable hours in the existing private-package and quotation workflow. The feature uses the existing `requested_services` field and requires the single-row booking-draft migration.

## Verification

API and Astro type checks passed. The booking request, conversational booking, draft migration, quotation and Edge routing tests passed 54 cases, with one opt-in live model case skipped. The catalog, booking review and quotation web tests passed 64 cases. The Edge bundle built into scratch storage. A dedicated PostgreSQL instance had all 84 migrations applied and reported an up-to-date schema.

Chromium verified mobile and desktop layouts, keyboard selection, public sign-in and resumed review, stale package and service refresh, stored add-on terms, customer and admin details, quotation preparation and a package-less manual request in the original chat. The repository design and web structure checks still report their existing findings in thumbnail, catalog and message styles.

## Resume here

Open the [local package preview](http://localhost:45173/packages/garden-filipiniana-wedding) while the isolated runtime is available. Select **Book now**, add a service, enter hours and review the request. See the [booking rules](../business/booking-requests.md#rules-and-boundaries) and [quotation workflow](../business/quotations.md#main-workflow-and-handoffs) for the admin handoff. Apply the existing booking-draft migration on the target before a coordinated release.
