BEGIN;
LOCK TABLE media_assets IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM media_assets WHERE source = 'external') THEN
    RAISE EXCEPTION 'Replace externally linked catalog media with uploads before applying the upload-only migration. Existing media has not been deleted.';
  END IF;
END $$;
ALTER TABLE media_assets DROP CONSTRAINT media_assets_source_check;
ALTER TABLE media_assets DROP CONSTRAINT media_assets_source;
ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_source_check CHECK (source IN ('upload', 'sample')),
  ADD CONSTRAINT media_assets_source CHECK (
    (source = 'upload' AND storage_key IS NOT NULL AND url IS NULL
      AND mime_type IS NOT NULL AND byte_size IS NOT NULL AND byte_size > 0
      AND ((kind = 'image' AND byte_size <= 10485760) OR (kind = 'video' AND byte_size <= 26214400)))
    OR (source = 'sample' AND kind = 'image' AND url IS NOT NULL
      AND url IN ('/images/wedding.jpg', '/images/dinner.jpg', '/images/dessert.jpg', '/images/hero.jpg')
      AND storage_key IS NULL AND byte_size IS NULL)
  );
COMMIT;
