BEGIN;

-- Keep sample media local and explicitly allowlisted, including the attributed
-- demo photographs. Existing uploads and their byte/type limits are unchanged.
ALTER TABLE media_assets DROP CONSTRAINT media_assets_source;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_source CHECK (
  (source = 'upload' AND storage_key IS NOT NULL AND url IS NULL
    AND mime_type IS NOT NULL AND byte_size IS NOT NULL AND byte_size > 0
    AND ((kind = 'image' AND byte_size <= 10485760) OR (kind = 'video' AND byte_size <= 26214400)))
  OR (source = 'sample' AND kind = 'image' AND url IS NOT NULL
    AND url IN (
      '/images/wedding.jpg', '/images/dinner.jpg', '/images/dessert.jpg', '/images/hero.jpg',
      '/images/catalog-greenery.jpg', '/images/catalog-birthday.jpg',
      '/images/catalog-conference.jpg', '/images/catalog-dj.jpg',
      '/images/catalog-coastal.jpg', '/images/catalog-ballroom.jpg'
    )
    AND storage_key IS NULL AND byte_size IS NULL)
);

COMMIT;
