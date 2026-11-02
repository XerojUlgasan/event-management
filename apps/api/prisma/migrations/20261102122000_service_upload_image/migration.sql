-- Existing image values cannot be interpreted as uploaded object IDs.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM service_versions WHERE image_url IS NOT NULL OR state = 'published') THEN
    RAISE EXCEPTION 'Remove or migrate existing service images and published services before applying this migration';
  END IF;
END $$;
ALTER TABLE service_versions DROP COLUMN image_url, ADD COLUMN image_id UUID;
ALTER TABLE service_versions ADD CONSTRAINT service_versions_published_image CHECK (state <> 'published' OR image_id IS NOT NULL);
