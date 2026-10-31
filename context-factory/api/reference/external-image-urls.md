# External catalog image URLs

Package and service versions keep one optional external HTTPS `image_url` (API field `imageUrl`). Venue versions keep up to 10 ordered external HTTPS `image_urls` (API field `imageUrls`). The first venue URL is the cover photo. The API accepts and returns URLs; it does not upload or proxy image bytes.

Migration `20261101110000_external_catalog_image_urls` removes the old upload metadata tables and venue photo join table. It stops if any uploaded image records exist, because dropping those records would leave R2 files and API-relative URLs without a safe conversion. Replace those images with externally hosted HTTPS URLs and clear the old uploaded records through a separately reviewed cleanup before applying the migration. It also clears any stale package or service API-relative image paths. Historical migrations remain in the repository for fresh database setup.
