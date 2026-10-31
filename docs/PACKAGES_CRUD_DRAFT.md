# Package catalog implementation

Status: implemented locally, 2026-10-27; service assignments added 2026-10-28 and booking requests added 2026-10-29. This document records the package catalog behavior and its frontend contract. Service catalog behavior is in [SERVICES.md](SERVICES.md). The booking-request flow and remaining quote, availability, and confirmation work are tracked in [ROADMAP.md](ROADMAP.md). `pnpm db:seed` creates sample drafts, but no approved package or service data is automatically published.

## Business boundary

- `FEATURES.md` defines all-inclusive offers for 30–100 guests. Published details include the guest range, fixed PHP total, inclusions, exclusions, and terms. Venue records belong to a standalone catalog and are not package API or screen fields or publication requirements. Keep the legacy venue-details database field so existing values remain stored; do not expose it in package DTOs or previews. Booking-request preferred venue/location remains a separate inquiry field. Paid add-ons are separate from package inclusions.
- A package catalog entry does not reserve a date or establish a final quote. A published package preview can start a signed-in booking request, which staff review separately.
- Admin and public/customer package screens now read the same persisted catalog through `/v1`. Old dollar-denominated demo offers were removed from the package array and were not seeded. Exact tiers, amounts, and additional inclusions still need business approval.

## Business rules for the catalog

1. Only an authenticated `admin` may create, edit, publish, archive, or delete a package. The API checks the database role on every write and admin read. Anyone may read the current published catalog; drafts, archived packages, and superseded versions stay private to admins.
2. Create a package as a draft with a stable ID. The standard catalog accepts a package range within 30–100 guests, with minimum no greater than maximum. An inquiry outside the offered range goes to staff review; catalog CRUD must not silently create an out-of-range standard offer.
3. A published version is immutable. Editing it creates a new draft version. Publishing validates required details and atomically supersedes the former version; its contents remain in history for future quote references. A failed publish leaves the former published offer intact.
4. Archive removes an offer from new public/customer selection without erasing its versions. Archived packages reject edits and publication. Hard delete is limited to a package that has never been published and has no database reference; otherwise the API returns a conflict. A restore operation is not implemented.
5. Admins enter each package's inclusions; the API does not append a standard list. At least one free-text inclusion or structured included service is required for publication. Exclusions may be empty. Optional paid add-ons use the separate service catalog; availability rules remain future work.
6. Published packages use one fixed total price in PHP. Store the amount as integer centavos, never as `"From $72 / guest"`. Permit an unpriced draft but require a positive price before publication. Package visibility does not promise venue or add-on availability.

## Persistence and API contract

The Prisma migrations create `packages` and `package_versions`; Kysely runtime types were regenerated from the migrated schema.

- `packages` stores a stable ID, timestamps, and `archived_at`.
- `package_versions` stores a version number and state (`draft`, `published`, or `superseded`), catalog details, nullable fixed total `price_amount_minor`, and timestamps. The legacy venue-details column remains in storage for existing data but is excluded from current package API/display behavior. Partial unique indexes allow at most one draft and one published version per package. A database check enforces the 30–100 guest range.
- `package_versions.image_url` stores an optional external HTTPS image URL. The API does not store or upload image files. See the [image cleanup migration](../context-factory/api/reference/external-image-urls.md).
- `package_services` holds UUID-identified links from a package version to published service versions. A link is either included within the package total or an optional add-on with a fixed PHP per-unit price and maximum quantity. Published package versions retain their linked service-version details.
- Future quotes should reference the version ID and store their issued line-item snapshot. No quote table or package reference exists yet.

The API price value is `null` for an incomplete draft or `{ kind: "fixed", currency: "PHP", amountMinor }` for an approved fixed total. The server validates `amountMinor` as a positive integer. Display it with PHP currency formatting; the API never trusts a display string as a price.

| Route | Access | Behavior |
| --- | --- | --- |
| `GET /v1/packages` and `GET /v1/packages/:id` | Public | Current published, non-archived version only. Unknown, draft, and archived IDs return 404 on detail read. |
| `GET /v1/admin/packages` and `GET /v1/admin/packages/:id` | Admin | List/detail with draft, published, archived status and version history. Search/status filters run in the admin UI. |
| `POST /v1/admin/packages` | Admin | Validate input and create a draft; return stable package and draft version IDs. |
| `PATCH /v1/admin/packages/:id/draft` | Admin | Update only the draft, using a revision or `updatedAt` precondition to reject stale edits with 409. Editing a published offer first creates a new draft copy. |
| `POST /v1/admin/packages/:id/publish` | Admin | Accept the reviewed draft's `expectedUpdatedAt`, reject stale or archived drafts with 409, validate completeness and fixed PHP price, then publish in a transaction. |
| `POST /v1/admin/packages/:id/archive` | Admin | Hide an existing offer from new selection while retaining history. |
| `DELETE /v1/admin/packages/:id` | Admin | Hard-delete only a never-published, unreferenced draft; otherwise 409. |

The API follows the repository's `@hono/zod-openapi` pattern in `apps/api/src/controllers/packages/`. The request origin guard covers write methods, CORS allows `PATCH` and `DELETE`, and catalog writes have a body limit. Session cookie auth and the database role authorize admin routes; a Firebase ID token alone does not. Public queries exclude drafts and archived versions.

## Frontend integration

1. `apps/web/src/lib/api.ts` has typed catalog DTOs and explicit PATCH/DELETE support, with session cookies and API error messages.
2. `PackageCatalog.tsx` fetches published packages for public and customer views. Its full-screen preview fetches the selected package ID and shows its approved image, terms, inclusions, guest range, and fixed PHP total. It handles loading, empty, and error states. Admins can preview draft or published versions in the same overlay without publishing them.
3. `PackagesPage.tsx` fetches admin records and supports a three-step create/edit form: essentials, experience, and pricing/media. Event types, inclusions, and exclusions use removable tags. The final step lists missing publication requirements before draft submission, and the publish dialog guides incomplete drafts back to editing. The form accepts an HTTPS image URL. It uses stable IDs and `expectedUpdatedAt` for edit/publish conflicts. Search/status filters and counts use returned rows. The Quotations and Menus tabs state that they are not connected.
   The Experience step also assigns published services as included or optional priced add-ons. The Services sidebar item manages their drafts and publication. Public/customer preview separates included services and optional add-ons; neither implies availability or a quote.
4. The public fixed-reference success message was removed. Book now submits a real request with `packageId` and `packageVersionId`; My events and the manager Bookings queue show that persisted record. Payment and confirmed-booking areas remain future work.

## Verification performed

- The package suite checks external HTTPS image URLs, rejects former upload paths, and verifies image URLs on published versions alongside catalog behavior. Current verification is reported with the change that removed uploads.
- Both package migrations were applied to the configured local `event_management` database with `pnpm db:deploy`; no package or image records were seeded.
- Browser QA with local test accounts saved and reloaded a private draft, edited a ₱1,250.00 fixed total, and confirmed it displayed correctly. A temporary complete offer was then published: its PHP price, terms, exclusions, and inclusions appeared in the public detail dialog, and its card appeared in the customer catalog. After archival, the public catalog returned to its empty state. Both temporary records were removed from the local database after testing; no package records were seeded.
- Earlier browser QA covered the previous upload workflow. The current editor accepts an HTTPS image URL and no longer uploads files; a new browser check is needed to prove the updated UI journey.

## Business decisions required before publication

- Exact package names/tiers and per-package guest ranges within the 30–100 offer.
- Exact fixed PHP amounts and whether taxes/service charges affect the displayed price.
- Exact inclusions, exclusions, terms, image ownership, and which optional items are paid add-ons.
- Whether any role beyond the current `admin` may publish, and whether a restore operation is needed after archiving.

Admins should enter only business-approved offers. The application validates completeness and price shape; it cannot determine whether a specific amount or term was approved outside the system. Availability, quote approval, reservation fees, and booking confirmation remain separate workflows.
