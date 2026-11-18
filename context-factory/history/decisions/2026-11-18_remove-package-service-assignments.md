# Remove relational package service assignments

Date: 2026-11-18
Status: accepted
Authority: The user requested removal of `package_services` and its remaining code after verifying that canvas widgets use owner JSONB instead.

## Decision

Remove the included/optional assignment feature from catalog and private packages. Linked service/package widgets remain in `packages.canvas` and `services.canvas`, with current listing previews resolved from their IDs. Placement does not establish inclusion, availability, or a price adjustment.

Remove the table through forward migration `20261118121512_remove_package_services`, its Prisma model and generated Kysely table type, shared assignment types, request/response fields, editor controls, rendered assignment lists, and assignment-dependent AI preparation and invalidation. Package contracts reject the old `services` payload field.

## Consequences

The migration discards existing assignment rows. It preserves catalog records and canvases, prices, bookings, quotations, media, and historical audit metadata. Derived overview chunks for packages with assignments are removed because they can retain old inclusion text; ordinary catalog saves or the provider-backed catalog embedding command rebuild those overviews. Other knowledge chunks remain intact.

Deploy the matching API and frontend with the migration. Historical migrations remain unchanged for replay. The obsolete one-time cleanup script for versioned catalog data is removed rather than updated to a schema it never supported.

This supersedes the relational-assignment portion of the [canvas JSONB decision](2026-11-16_catalog-canvas-jsonb.md) and the dependent-package overview behavior in the [embedding ingestion decision](2026-11-16_catalog-embedding-ingestion.md). Their other decisions remain in effect. The [root README](../../../README.md#catalogs-and-media) and [database guidance](../../areas/api/references/database-and-migrations.md) describe current behavior.
