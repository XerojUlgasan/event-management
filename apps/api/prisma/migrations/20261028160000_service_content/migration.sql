ALTER TABLE service_versions ADD COLUMN categories TEXT[] NOT NULL DEFAULT '{}', ADD COLUMN image_url TEXT;
UPDATE service_versions SET categories = ARRAY[category];
ALTER TABLE service_versions ALTER COLUMN categories DROP DEFAULT, DROP COLUMN category, DROP COLUMN coverage, DROP COLUMN duration_minutes, DROP COLUMN setup_minutes, DROP COLUMN setup_needs;
CREATE TABLE service_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
