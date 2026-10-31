# R2 catalog image storage

Venue, service, and package JPEG/PNG uploads live in the Cloudflare R2 bucket named by `R2_BUCKET_NAME`. Keep the bucket private. The API uses `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` for the S3-compatible endpoint. Keep these values in `apps/api/.env`, never in browser code or repository notes. `R2_ENDPOINT` is the account S3 API URL, not a public image domain.

## Object key standard

Use one key per immutable uploaded image:

| Catalog | R2 key | API URL |
| --- | --- | --- |
| Venue | `venues/<image-uuid>.jpg` or `.png` | `/v1/venue-images/<image-uuid>` |
| Service | `services/<image-uuid>.jpg` or `.png` | `/v1/service-images/<image-uuid>` |
| Package | `packages/<image-uuid>.jpg` or `.png` | `/v1/package-images/<image-uuid>` |

The UUID is generated once before upload and is also the `id` in the matching image metadata table. `image/jpeg` maps to `.jpg`; `image/png` maps to `.png`. `imageObjectKey` in `apps/api/src/utils/upload-image-to-r2.ts` is the single key builder. Do not use client filenames, venue/package names, or version numbers in keys. A catalog version stores an API-relative image URL, not an R2 endpoint or public bucket URL.

## Data and access

`package_images`, `service_images`, and `venue_images` hold only `id`, `content_type`, and `created_at`. Image bytes are not stored in PostgreSQL. Upload through `uploadImageToR2` before inserting metadata; remove the R2 object if the insert fails. The existing image GET routes check publication and System Administrator access through database state before fetching R2 bytes, then proxy the image with its stored content type and `nosniff`. Keep the bucket private so a guessed key cannot bypass those rules.

Image deletion still checks every version reference under row locks. After the database transaction commits, remove unreferenced R2 objects. A failed R2 deletion may leave an orphan object; the API logs the key for follow-up without undoing the committed catalog change. Never delete the R2 object before a transaction that may roll back.

## Local schema rollout

`20261031130000_r2_image_metadata` removes the three `data` byte columns. It deliberately aborts if any image table contains rows. This project migration supports the configured empty local image tables only; there is no legacy byte backfill. Verify all three counts are zero before applying it. If another database has image rows, keep it on the old schema until a separate, reviewed R2 backfill is built for that database. Do not reset that database or drop its bytes to force this migration through.

The API behavior tests use an in-memory fake for R2 object operations plus disposable PostgreSQL databases. They prove route rules and storage calls without touching the real bucket. A passing typecheck or fake R2 test is not proof of live R2 credentials, permissions, or availability.
