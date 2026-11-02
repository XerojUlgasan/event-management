# Catalog media and image migrations

## Shared catalog canvas media

Package, service, and venue canvas pages store media references in `media_assets`; uploaded bytes are stored in R2. The shared editor uploads one file at a time to `POST /v1/admin/catalog-media`. An upload remains pending until a catalog save references its media ID. The owning administrator can discard an unreferenced upload through `DELETE /v1/admin/catalog-media/{id}`. Saved uploads stream through `GET /v1/catalog-media/{id}`.

Uploaded canvas images must be JPEG, PNG, or WebP and at most 10 MiB. Videos must be MP4 or WebM and at most 25 MiB. The API checks file content type as well as request MIME type. The multipart catalog-media transport cap is 25 MiB plus 64 KiB overhead.

Photo and video widgets accept uploads only. External image/video URLs and hosted YouTube/Vimeo embeds are rejected. Sample image media uses the checked-in paths allowed by the catalog schema. Migration `20261102140000_upload_only_catalog_media` enforces this in PostgreSQL and refuses to proceed if external media rows remain, preserving those rows for deliberate replacement with uploads.

When a catalog save removes or replaces uploaded media, the API deletes the R2 object and media row only if no catalog widget still references it. Cleanup runs after the database save; a failed R2 deletion leaves the unreferenced record and does not undo the saved catalog record. Each new upload also retries cleanup for up to 10 unreferenced assets older than 24 hours. `pnpm --filter @event-management/api media:cleanup` retries up to 100 unreferenced catalog assets older than 24 hours.

Public requests can stream media referenced by published, non-archived catalog records. A signed-in System Administrator also has a private, no-store fallback for that administrator's pending uploads and uploads referenced by archived records.

## Services and venues

Each service and venue is a flat record with one catalog page. Public streaming requires a media reference from that record's page while it is published and non-archived. An unpublished or archived record's media is not public; an administrator preview can access media associated with that administrator's own pending uploads or archived records. Omitted `sections` on a full-content update preserve the current canvas.

The legacy service-image upload routes remain supported. Those uploaded bytes are stored in R2 and exposed through `/v1/service-images/{id}`; service DTOs include `imageId` and `imageUrl`. Service saves require either the existing legacy image or a canvas photo. Venues retain up to 10 ordered legacy HTTPS photo URLs, and those existing photos remain available in details; new canvas photo/video widgets use uploads. Venue photos are optional.

Migration `20261102180000_flat_services_venues` preserves IDs, timestamps, current published metadata, and the selected canvas. If no version was published, it preserves the latest content and archives the resulting record. Existing archived records remain archived. The migration drops unselected version pages and the service/venue version tables. It does not delete uploaded R2 objects. Back up before deployment if version history matters; inspect all pending migrations because earlier migrations can have separate destructive effects.
