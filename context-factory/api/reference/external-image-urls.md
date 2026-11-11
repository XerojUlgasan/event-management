# Catalog media and image migrations

## Shared catalog canvas media

Package, service, and venue canvas pages store media references in `media_assets`; uploaded bytes are stored in the private Supabase Storage bucket `event-management`, using the object key `catalog-media/<id>`. Existing objects are not copied. The shared editor uploads one file at a time to `POST /v1/admin/catalog-media`. An upload remains pending until a catalog save references its media ID. The owning administrator can discard an unreferenced upload through `DELETE /v1/admin/catalog-media/{id}`. Saved uploads stream through `GET /v1/catalog-media/{id}`.

Uploaded canvas images must be JPEG, PNG, or WebP and at most 10 MiB. Videos must be MP4 or WebM and at most 25 MiB. The API checks file content type as well as request MIME type. The multipart catalog-media transport cap is 25 MiB plus 64 KiB overhead.

Photo and video widgets accept uploads only. External image/video URLs and hosted YouTube/Vimeo embeds are rejected. Sample image media uses the checked-in paths allowed by the catalog schema. Migration `20261102140000_upload_only_catalog_media` enforces this in PostgreSQL and refuses to proceed if external media rows remain, preserving those rows for deliberate replacement with uploads.

When a catalog save removes or replaces uploaded media, the API deletes the Storage object and media row only if no current catalog widget references it. Cleanup runs after the database save; a failed Storage deletion leaves the unreferenced record and does not undo the saved catalog record. Each new upload also retries cleanup for up to 10 unreferenced assets older than 24 hours. `pnpm --filter @event-management/api media:cleanup` retries up to 100 unreferenced catalog assets older than 24 hours.

Public requests can stream media referenced by published, non-archived catalog records. A signed-in System Administrator also has a private, no-store fallback for that administrator's pending uploads and uploads referenced by archived records.

## Private proposal and quotation media

Uploaded catalog media is copied to independent pending media IDs and Storage keys before a custom proposal is attached. The booking transaction rechecks booking/package revisions and validates references; failed or interrupted staging is recoverable through cleanup. A custom save never shares an uploaded Storage key with its source catalog page.

Public streaming requires a catalog package, not merely a nonarchived package row. The owner can stream uploads currently referenced by its custom proposal; System Administrators have the protected preview path. Private streams use `private, no-store`, including byte ranges. Quotations neither retain media snapshots nor grant customer media access.

Reference checks and stale cleanup use current widgets. Removing or replacing the last widget reference makes an upload eligible for cleanup, even when an old quotation referred to that package. A fake Storage API test establishes local copy/cleanup behavior, not live Supabase Storage success.

## Services and venues

Each service and venue is a flat record with one catalog page. Public streaming requires a media reference from that record's page while it is published and non-archived. An unpublished or archived record's media is not public; an administrator preview can access media associated with that administrator's own pending uploads or archived records. Omitted `sections` on a full-content update preserve the current canvas.

All service and venue photos use canvas widgets and `media_assets`, uploaded through `/v1/admin/catalog-media` and streamed through `/v1/catalog-media/{id}`. Services require a canvas photo on save; venue photos are optional. Service `imageUrl` is derived from the first photo widget. Migration `20261102190000_cleanup_catalog_fields` drops `services.image_id` and venue `image_urls`/`categories`; the old `/v1/admin/service-uploads` and `/v1/service-images/{id}` routes are removed. It deliberately discards those legacy references without deleting uploaded storage objects or changing existing canvas content.

Migration `20261102180000_flat_services_venues` preserves IDs, timestamps, current published metadata, and the selected canvas. If no version was published, it preserves the latest content and archives the resulting record. Existing archived records remain archived. The migration drops unselected version pages and the service/venue version tables. It does not delete uploaded storage objects. Back up before deployment if version history matters; inspect all pending migrations because earlier migrations can have separate destructive effects.
