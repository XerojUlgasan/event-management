# Package catalog implementation

Updated: 2026-11-02. This document describes the current direct-save package contract. Services and venues are also flat catalogs; service details are in [SERVICES.md](SERVICES.md). Booking requests are inquiries, not reservations, quotes, or confirmations.

## Package lifecycle

- Only a signed-in System Administrator can create, edit, archive, or delete packages. Public reads expose published, non-archived packages; staff can read the public catalog.
- A package is a complete record. `POST /v1/admin/packages` creates it and publishes it immediately. `PATCH /v1/admin/packages/{id}` saves edits directly to that published record and requires `expectedUpdatedAt`; stale edits return `409`.
- There is no package draft, publish step, version history, or package-to-service assignment in this contract. Archiving hides a package from new public selection and booking requests. `DELETE /v1/admin/packages/{id}` succeeds only if no booking request references it; otherwise it returns `409`.
- Package selection does not establish availability, a venue reservation, or a final quote. The booking request's preferred venue/location is separate from the standalone venue catalog.

Services and venues are also flat, directly saved catalogs. The reusable catalog-page schema owns one page per package, service, or venue. This package contract does not add service assignments.

## Content and media

The shared `PackageContent` contract contains:

- `name`, positive integer `maxGuests`, and a required fixed PHP `price`.
- `description`, an editable catalog summary in Package details (up to 4,000 characters), independent of canvas Markdown. Admin and public cards display it.
- `sections`, each with an optional title and widgets arranged on a 12-column canvas. Widgets are `photo`, `markdown`, or `video`; Markdown is rendered as package content, and media widgets can contain captions and image descriptions.

The API price is `{ kind: "fixed", currency: "PHP", amountMinor }`, where `amountMinor` is centavos and must be divisible by 100. PostgreSQL stores the package total as an integer number of pesos. The package card summary uses the saved description; the cover image is derived from the first photo widget. Migration `20261102170000_package_description` copies each existing first-Markdown excerpt into the new field so current card text is preserved. Later canvas edits do not rewrite it. Older edit clients may omit `description` without erasing the saved value.

The schema permits up to 20 sections and 100 widgets across a page; a Markdown widget is limited to 20,000 characters. Shared catalog text fields are limited to 4,000 characters. The admin catalog JSON body limit is 3 MiB.

Photo and video widgets accept uploaded files only, alongside the built-in seeded sample photos. Uploads go through `POST /v1/admin/catalog-media` and are stored in R2. Images must be JPEG, PNG, or WebP and at most 10 MiB; videos must be MP4 or WebM and at most 25 MiB. Uploaded media remains pending until a package save references it. `DELETE /v1/admin/catalog-media/{id}` discards an unreferenced upload; saved media is served through `/v1/catalog-media/{id}`. The editor and API reject external photo/video URLs, including YouTube and Vimeo links.

Packages, services, and venues share the page schema and canvas editor. All three catalogs use canvas media; there are no separate service images or venue URL photos. Migration `20261102180000_flat_services_venues` retains the selected current content and removes version tables and unselected version pages; uploaded media objects are not deleted by the migration. Back up before deployment if service/venue version history matters and inspect all pending migrations. See [catalog media and image migrations](../context-factory/api/reference/external-image-urls.md) for storage details.

The editor canvas shows only the photo or video preview inside each media widget. Its three-dot settings button opens a modal containing the upload, optional caption, image description (photo only), and autoplay toggle (video only). Closing the modal keeps changes in the current editor session; Save changes publishes them, while Cancel discards them. Captions remain part of customer-facing content and image descriptions supply alternative text.

Each widget has a boolean `autoplay`, defaulting to false. Only video widgets can enable it. Customer pages and the in-editor customer preview honor this option using muted inline playback with native controls; the editing canvas and settings modal do not autoplay. Browsers can still block automatic playback. Migration `20261102150000_catalog_video_autoplay` adds the field and a video-only database constraint without deleting existing content.

## API routes

| Route | Access | Behavior |
| --- | --- | --- |
| `GET /v1/packages` | Public | List published, non-archived packages; optional `limit` (1–15) and `offset` return `nextOffset`. |
| `GET /v1/packages/{id}` | Public | Read one published, non-archived package; otherwise `404`. |
| `GET /v1/admin/packages` and `GET /v1/admin/packages/{id}` | System Administrator | List and read package records, including archived records. |
| `POST /v1/admin/packages` | System Administrator | Create a complete package and publish it immediately. |
| `PATCH /v1/admin/packages/{id}` | System Administrator | Save complete package content with `expectedUpdatedAt`; stale or archived edits return `409`. |
| `POST /v1/admin/packages/{id}/archive` | System Administrator | Archive the package so it is no longer offered for new inquiries. |
| `DELETE /v1/admin/packages/{id}` | System Administrator | Delete only when no booking request references the package; otherwise `409`. |
| `POST /v1/admin/catalog-media` | System Administrator | Upload one pending image or video file to R2. |
| `DELETE /v1/admin/catalog-media/{id}` | System Administrator | Discard the caller's pending upload if it has not been saved. |
| `GET /v1/catalog-media/{id}` | Public | Stream uploaded media referenced by catalog content. |

Writes use the database role and a valid `em_session` cookie. A Firebase ID token alone does not authorize catalog administration.

## Booking-request snapshots

`POST /v1/booking-requests` accepts `packageId` and an optional ISO `packageUpdatedAt`; it does not accept `packageVersionId`. If the optional timestamp does not match the current package `updatedAt`, the API returns `409` so the client can refresh. On creation, the database snapshots the package name, integer-peso price, and guest maximum. Responses expose these as `packageName`, `packagePrice` (`{ kind: "fixed", currency: "PHP", amountMinor }`), and `packageMaxGuests`. Later package edits do not change existing request snapshots.

Requests also store the customer's preferred date, event type, estimated duration, contact details, notes, status, and status history. Guest count may be omitted; exact times and preferred venue/location remain follow-up details. An accepted request is still not a confirmed booking or a date hold.

## Persistence and migration impact

`packages` now stores each package directly: stable ID, name, positive guest maximum, whole-peso price, publication timestamp, archive timestamp, and create/update timestamps. There is no `package_versions` or `package_services` table.

The reusable page model consists of `catalog_pages`, `catalog_sections`, `catalog_widgets`, and `media_assets`. A page has exactly one package, service, or venue owner. Package pages store Markdown and media widget layout; uploaded media rows refer to R2 objects, while built-in sample media refers to allowlisted local paths.

Migration `20261102130000_package_canvas` intentionally recreates the package catalog. Applying it removes existing package records, package versions and service assignments, all existing booking requests and their status history, and conversations/messages linked to those requests. General conversations and their messages are preserved. Review this data impact before applying the migration to a database with records; `pnpm db:deploy` does not make this reset reversible.

The seed inserts three sample published packages with sample photos and Markdown: The Grand Celebration (₱185,000; up to 150 guests), The Intimate Gathering (₱68,000; up to 50 guests), and The Sweet Soirée (₱95,000; up to 80 guests). These are demonstration records, not business approval. See [database seed](SEED.md).

## Verification boundary

The API package suite is `pnpm --filter @event-management/api test:packages`; booking snapshot behavior is covered by `pnpm --filter @event-management/api test:booking-requests`. These suites use disposable local PostgreSQL databases. Code and API tests do not establish browser behavior, availability, production R2 configuration, or production deployment success.

Exact package descriptions, inclusion claims, imagery rights, price approval, and future quote rules still require business review. Availability, quotations, reservation fees, payments, and booking confirmation are separate workflows.
