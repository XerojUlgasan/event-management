-- Existing database images have no R2 objects. This rollout intentionally
-- supports empty image tables only, so it must stop before dropping bytes if
-- any image is present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM package_images)
     OR EXISTS (SELECT 1 FROM service_images)
     OR EXISTS (SELECT 1 FROM venue_images) THEN
    RAISE EXCEPTION 'Image tables must be empty before moving image storage to R2';
  END IF;
END $$;

ALTER TABLE package_images DROP COLUMN data;
ALTER TABLE service_images DROP COLUMN data;
ALTER TABLE venue_images DROP COLUMN data;
