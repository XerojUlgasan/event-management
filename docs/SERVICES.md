# Service catalog

Services are standalone offerings such as a coffee bar, grazing table, magazine booth, photo booth, or tattoo booth. These are examples, not approved catalog records or prices. The current package catalog does not assign services to packages.

## Records and pricing

Each service is one flat catalog record with one `catalog_page`. There is no `service_versions` table or draft/publish/history lifecycle. The record carries its content, publication timestamp, archive timestamp, and create/update timestamps. Its DTO contains content with `id`, `archivedAt`, `createdAt`, `updatedAt`, and `publishedAt`; services also expose `imageId` and `imageUrl` for the legacy service-image upload.

A service save requires a name, description, positive whole-PHP-peso hourly rate, and either its existing legacy image or a photo in the canvas. The API also supports legacy migrated records with a null rate or image for reads; updates must satisfy the current input validation. Service categories are not stored. Optional omitted canvas sections are preserved on update.

## API and screens

Public `GET /v1/services` and `GET /v1/services/:id` expose active published, non-archived services. The list supports optional `limit` (1–15) and `offset`, returning `nextOffset`; omitting `limit` retains the full-list response. Admin routes under `/v1/admin/services` support list, detail, create, full-content update, archive, and eligible deletion. `POST /v1/admin/services` saves a public active record directly. `PATCH /v1/admin/services/{id}` replaces its full content and requires `expectedUpdatedAt`; stale or archived updates return `409`. `POST /v1/admin/services/{id}/archive` removes it from public reads. Eligible deletion uses `DELETE /v1/admin/services/{id}`. Admin access requires the database `admin` role, `System Administrator` staff title, and a valid session. There is no service-to-package listing route.

The legacy service-image upload API remains available: multipart `POST /v1/admin/service-uploads` and `PATCH /v1/admin/service-uploads/:id` send JSON content in `content` and the file in `image`. JPEG, PNG, and WebP uploads are limited to 10 MiB, stored in Cloudflare R2, and fetched through `GET /v1/service-images/:id`. JSON DTOs return the uploaded image UUID as `imageId`; public `imageUrl` selects the canvas photo or legacy image. New canvas photos and videos use `/v1/admin/catalog-media`. Configure the R2 variables named in `apps/api/.env.example` for actual uploads.

The admin workspace reuses the package canvas editor for photo, Markdown, and video widgets, section ordering, drag/resize, media settings, and customer/card previews. Service details contain the catalog description and hourly rate. Saving creates or updates the active catalog record directly; archive hides it. Once published, a service can appear among the first three cards on `/`; View more opens the paged catalog overlay. Service selection does not check availability, submit an inquiry, create a quote, hold a date, or confirm a booking. Staff must confirm capacity and delivery terms before quoting.

## Migration and media behavior

Migration `20261102180000_flat_services_venues` converts services to flat records while preserving entity IDs, timestamps, current published metadata, and the selected canvas. If there is no current published version, it keeps the latest content and archives that record. Existing archived records stay archived. Unselected version pages and the version tables are removed; uploaded media objects are not deleted by the migration. Back up before deployment if version history matters, and inspect all pending migrations because the earlier package-canvas migration `20261102130000_package_canvas` has a separate destructive impact.

Public canvas-media access requires a reference from a non-archived service page. Legacy service images retain their existing UUID-based streaming endpoint. An administrator preview may access that administrator's own pending uploads and media attached to archived records. See [shared catalog canvas](CATALOG_CANVAS.md) and the [catalog media reference](../context-factory/api/reference/external-image-urls.md).

## Business details to confirm

Before publishing real services, approve each offered configuration, describe its scope clearly, and confirm its hourly rate. Capacity, provider scheduling, and date conflicts still need operating rules before automated availability can be promised. Keep different sellable configurations as separate services until variant rules are defined.
