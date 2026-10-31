-- Uploaded images have no external URL to preserve when their API routes are removed.
-- Stop until existing uploads have been reviewed and replaced with external URLs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM package_images)
     OR EXISTS (SELECT 1 FROM service_images)
     OR EXISTS (SELECT 1 FROM venue_images) THEN
    RAISE EXCEPTION 'Catalog image uploads exist. Replace their references with external URLs and clear the upload tables before applying this migration.';
  END IF;
END $$;

ALTER TABLE venue_versions ADD COLUMN image_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE package_versions SET image_url = NULL WHERE image_url LIKE '/v1/package-images/%';
UPDATE service_versions SET image_url = NULL WHERE image_url LIKE '/v1/service-images/%';
DROP TABLE venue_version_photos;
DROP TABLE venue_images;
DROP TABLE service_images;
DROP TABLE package_images;
