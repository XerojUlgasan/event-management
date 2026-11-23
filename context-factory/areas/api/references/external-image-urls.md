# Catalog media and image migrations

## Shared catalog canvas media

Packages and services store their canvas as ordered section/widget arrays in the owner's `canvas` JSONB column. A widget stores its `mediaId`; `media_assets` remains the authoritative media record for source, kind, optional URL, MIME type, and storage metadata. Uploaded bytes are stored in the private Supabase Storage bucket `event-management`, using the owner paths below. Migration `20261116072801_embed_catalog_canvas` does not copy or delete media records or Storage objects. The shared editor uploads one file at a time to `POST /v1/admin/catalog-media`. An upload remains pending until a catalog save references its media ID. The owning administrator can discard an unreferenced upload through `DELETE /v1/admin/catalog-media/{id}`. Saved uploads stream through `GET /v1/catalog-media/{id}`.

## Storage filing and recovery

- Unattached uploads: `pending/<admin-id>/<media-id>.<ext>`.
- Catalog packages: `packages/<package-id>/images/<media-id>.<ext>` or `videos/`.
- Services: `services/<service-id>/images/<media-id>.<ext>` or `videos/`.
- Private custom packages: `bookings/<booking-id>/custom-package/images/<media-id>.<ext>` or `videos/`.

Extensions are `jpg`, `png`, `webp`, `mp4`, or `webm`, selected from the checked MIME type. Folder ownership comes from current canvas and dedicated thumbnail references, not a client-supplied Storage path. IDs survive listing renames. Sample photos remain checked-in files; original upload filenames are not stored.

After the owner save commits, promotion locks each media row and copies a new pending upload into its current owner's folder. It commits the new `storage_key` before deleting the pending copy. A failed copy leaves the original pending object readable; saving the owner again retries promotion. A failed pending deletion can be retried on a later save or unreferenced-media cleanup. Deterministic destinations allow retrying a copy with the same immutable bytes. Storage transfers used for promotion are bounded by 30-second calls. Readers refresh the same authorized media ID's key if a concurrent promotion removed the pending path.

Clemora is still in development and has not reached production. The user explicitly excluded migration/preservation of existing documents from this redesign on 2026-11-18. Only newly generated `pending/` paths are promoted; existing legacy object keys are ignored. There is no schema migration, move-tracking table, existing-file organizer, or bulk deletion. Owner folders include dedicated thumbnails; ambiguous shared ownership is left unchanged. There is no scheduled retry or crash-recovery queue. A process interruption or database rollback after copying but before committing the new key can leave an unreferenced object in Storage. Existing development data is disposable, but deleting/resetting it is a separate operation.

Photo freshness uses immutable media IDs rather than folder paths, so pending-to-owner promotion does not invalidate an unchanged photo's catalog embedding.

## File validation

Uploaded canvas images must be JPEG, PNG, or WebP and at most 10 MiB. Videos must be MP4 or WebM and at most 25 MiB. The API checks file content type as well as request MIME type. The multipart catalog-media transport cap is 25 MiB plus 64 KiB overhead.

Photo and video widgets accept uploads only. External image/video URLs and hosted YouTube/Vimeo embeds are rejected. Sample image media uses the checked-in paths allowed by the catalog schema. Migration `20261102140000_upload_only_catalog_media` enforces this in PostgreSQL and refuses to proceed if external media rows remain, preserving those rows for deliberate replacement with uploads.

When a save removes or replaces uploaded media, the API deletes the Storage object and media row only if there are no current references in package or service canvases, their thumbnails, or showcase covers and galleries. Canvas reference checks use JSONB containment against GIN-indexed owner canvases. Cleanup runs after the database save; a failed Storage deletion leaves the unreferenced record and does not undo the save. Each new upload also retries cleanup for up to 10 unreferenced assets older than 24 hours. `pnpm --filter @event-management/api media:cleanup` retries up to 100 unreferenced assets older than 24 hours. Upload row locks and ownership checks remain in place.

Public requests can stream media referenced by the canvas or dedicated thumbnail of a published, non-archived catalog record. A signed-in System Administrator also has a private, no-store fallback for that administrator's pending uploads and uploads referenced by archived records.

## Showcase media

Showcases select an image with `cover_media_id`. Gallery images and videos each have one `showcase_record_id` and a unique `gallery_position` within that showcase. The API changes attachments and order in the same transaction as the showcase save. Deleting a showcase detaches the gallery before deleting the record, then runs shared media cleanup.

Uploads use `POST /v1/admin/showcase-media` and the `showcase-media/<id>` key prefix in the private `event-management` bucket. `GET /v1/showcase-media/{id}` serves media referenced by published showcases, including video byte ranges. System Administrators can view saved draft media and their own pending uploads. The migration leaves the asset rows and objects for formerly separate preview videos in place. The usual stale media cleanup applies once those assets have no references.

## Private proposal and quotation media

Uploaded catalog media, including a dedicated uploaded thumbnail, is copied to independent pending media IDs and Storage keys before a custom proposal is attached. After attachment, it moves into that booking's custom-package folder. The booking transaction rechecks booking/package revisions and validates references; failed or interrupted staging is recoverable through cleanup. A custom save never shares an uploaded Storage key with its source package canvas.

Public streaming requires a catalog package, not merely a nonarchived package row. The owner can stream uploads currently referenced by its custom proposal canvas or thumbnail; System Administrators have the protected preview path. Private streams use `private, no-store`, including byte ranges. Quotations neither retain media snapshots nor grant customer media access.

Reference checks and stale cleanup use current canvas and thumbnail references. Removing or replacing the last widget reference makes an upload eligible for cleanup, even when an old quotation referred to that package. A fake Storage API test establishes local copy/cleanup behavior, not live Supabase Storage success.

## Service media

Each service is a flat record with its own canvas JSONB array. Public streaming requires a media reference in that service's current canvas or dedicated thumbnail while it is published and non-archived. An unpublished or archived record's media is not public; an administrator preview can access media associated with that administrator's own pending uploads or archived records. Omitted `sections` on a full-content update preserve the current canvas.

Service photos use canvas widgets and `media_assets`, uploaded through `/v1/admin/catalog-media` and streamed through `/v1/catalog-media/{id}`. Services require a canvas photo on save. Package, service, and linked-listing `imageUrl` values contain only the dedicated thumbnail URL, or null when unset. The shared frontend displays a branded default for null or failed thumbnail requests; canvas photos remain independent. Migration `20261102190000_cleanup_catalog_fields` drops `services.image_id` and legacy venue `image_urls`/`categories`; it deliberately discards those legacy references without deleting uploaded storage objects or changing existing canvas content.

Migration `20261102180000_flat_services_venues` is historical: it preserved IDs, timestamps, current published metadata, and the selected canvas when the older service and venue catalogs were flattened. Later migrations remove the venue catalog. `20261114151517_complete_catalog_staff_removal` deleted catalog pages left without a package or service owner but retained their media rows and Storage objects. `20261116072801_embed_catalog_canvas` then moved remaining package/service canvas content into owner JSONB arrays and dropped the former page/section/widget tables. Run `pnpm --filter @event-management/api media:cleanup` to remove stale media that no current owner canvas references. This command uses the existing age threshold; it does not delete shared media. Inspect all pending migrations and back up data when its history matters.
