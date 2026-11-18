-- Add dedicated thumbnail column to packages and services.
-- ON DELETE SET NULL: if the asset is later cleaned up, the listing falls back
-- to its first canvas photo rather than throwing a FK violation.
-- Partial indexes (non-null only) keep the reference-check EXISTS queries fast.

ALTER TABLE packages
  ADD COLUMN thumbnail_media_id UUID
  REFERENCES media_assets(id) ON DELETE SET NULL;

ALTER TABLE services
  ADD COLUMN thumbnail_media_id UUID
  REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX packages_thumbnail_media_id_idx
  ON packages (thumbnail_media_id)
  WHERE thumbnail_media_id IS NOT NULL;

CREATE INDEX services_thumbnail_media_id_idx
  ON services (thumbnail_media_id)
  WHERE thumbnail_media_id IS NOT NULL;
