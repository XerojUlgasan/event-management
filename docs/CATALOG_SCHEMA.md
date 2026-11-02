# Catalog schema conventions

Updated: 2026-11-02. Prisma owns the schema and migrations; runtime queries use Kysely. Regenerate `apps/api/src/db/types.ts` from migrated PostgreSQL with `pnpm db:generate`.

## Names

Use singular PascalCase Prisma models, plural snake_case SQL tables, camelCase Prisma/API properties, and snake_case SQL columns. Use the same name for the same concept across catalogs.

| Concept | Prisma / API | PostgreSQL |
| --- | --- | --- |
| Package or venue maximum guests | `maxGuests` | `max_guests` |
| Inquiry's saved package guest limit | `packageMaxGuests` | `package_max_guests` |
| Inquiry's actual guest count | `guestCount` | `guest_count` |

Packages require a positive maximum. Venue reads allow null for migrated incomplete records; saves require a positive maximum. Inquiry snapshots retain their original limit even after a package changes. `outOfRange` still means the recorded guest count exceeds that saved package limit.

## Removed metadata and media paths

Migration `20261102190000_cleanup_catalog_fields` renames guest-limit columns in place and removes:

- `packages.event_types`: event type belongs to the customer's inquiry. Intake offers Birthday, Wedding, Corporate, and a custom choice.
- `venues.categories` and `venues.image_urls`: venue descriptions and canvas content describe the venue; photos belong to canvas widgets.
- `services.image_id`: service photos use the same canvas/media path as packages and venues. The dedicated service-image upload and streaming routes are removed, along with the `imageId` and `removeImage` contracts.

The migration intentionally discards values in the removed fields. It preserves catalog IDs, descriptions, prices/rates, timestamps, archive status, canvas pages/widgets/media, bookings, snapshots, status history, and conversations/messages. It does not delete uploaded storage objects. Legacy service image objects may remain in storage without a reference; this migration does not attempt a remote bucket cleanup. Service saves still require a canvas photo. Venue photos remain optional.

Package and service response `imageUrl` values are derived from the first canvas photo; they are not database columns. `media_assets.url` remains necessary for built-in sample images, and uploaded assets use `storage_key`. Do not remove these shared media fields.

## Retained distinctions

- Package `price` is a fixed total in whole PHP pesos; service `hourlyRatePesos` is an hourly rate. They express different prices and retain their existing contracts.
- Inquiry `packageName`, `packagePrice`, and `packageMaxGuests` are historical snapshots, not redundant live joins.
- Inquiry `eventType`, preferred location, exact times, and nullable guest count remain valid customer/follow-up data.
- `publishedAt`, `archivedAt`, `createdAt`, and `updatedAt` serve publication, visibility, audit, and concurrency behavior.
- Messages keep `readAt` for unread counts and read receipts.

## Prisma and PostgreSQL alignment

Relations created by SQL with `ON UPDATE NO ACTION` declare `onUpdate: NoAction` explicitly in Prisma. This reflects the existing database behavior and avoids generating accidental cascading-update changes. Other relations retain their existing cascading updates. Migration `20261102191000_normalize_booking_history_index` renames the truncated booking-status-history index to Prisma's canonical name without rebuilding it or changing its columns.

## Deployment and verification

Deploy the renamed API and frontend contracts together with this forward migration; older clients sending removed properties are rejected. Do not edit previously applied migrations or reset a database to apply this cleanup. Back up a populated database before deployment and inspect all pending migrations, especially the earlier package-canvas reset.

`tests/catalog-cleanup-migration.test.ts` applies the cleanup to populated old-schema fixtures and compares all retained rows, including null venue limits, inquiry snapshots, linked messages, and uploaded canvas media. Package/venue/booking/message/seed suites cover current API and database behavior, including removed-field rejection and canvas uploads. Run `pnpm check`, `pnpm build`, and `pnpm db:validate` as well; browser interactions and configured R2 availability need separate evidence.

## Local verification on 2026-11-02

- Prisma schema validation, workspace types, and web/API builds passed. Prisma's comparison from the migrated local database to `schema.prisma` reported no difference.
- All 31 focused tests passed across catalog cleanup, previous canvas/flat migrations, packages/services, venues, booking requests, messages, and seed rerun preservation. These tests use disposable PostgreSQL databases; upload tests use a local S3-compatible fake, not production R2.
- In the browser at its default mobile viewport, package and venue saves succeeded and their details showed Maximum guests without the removed controls. Public package details rendered correctly. The service editor required a canvas photo. A signed-out custom-event draft survived customer sign-in and reached explicit review; it was closed without submitting an inquiry.
- The local database was backed up before deployment. Both forward migrations were applied locally; all 3 package, 18 venue, and 1 service records remained, along with all 8 original canvas widgets. No production database or remote storage cleanup was performed.
