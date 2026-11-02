-- Complete package recreation. Old package-related inquiry records and their
-- booking conversations are deliberately reset; general conversations survive.
BEGIN;
LOCK TABLE packages, package_versions, package_services, booking_requests,
  booking_request_status_history, conversations, messages IN ACCESS EXCLUSIVE MODE;
DELETE FROM conversations WHERE booking_request_id IN (SELECT id FROM booking_requests);
DELETE FROM booking_requests;
ALTER TABLE booking_requests DROP COLUMN package_version_id;
DROP TABLE package_services;
DROP TABLE package_versions;
DELETE FROM packages;
ALTER TABLE packages
  ADD COLUMN name TEXT NOT NULL,
  ADD COLUMN event_types TEXT[] NOT NULL,
  ADD COLUMN guest_max INTEGER NOT NULL CHECK (guest_max > 0),
  ADD COLUMN price INTEGER NOT NULL CHECK (price > 0 AND price <= 21474836),
  ADD COLUMN published_at TIMESTAMPTZ(6) NOT NULL DEFAULT now();
ALTER TABLE booking_requests
  ADD COLUMN package_price INTEGER NOT NULL CHECK (package_price > 0),
  ADD COLUMN package_guest_max INTEGER NOT NULL CHECK (package_guest_max > 0);

CREATE TABLE catalog_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID UNIQUE REFERENCES packages(id) ON DELETE CASCADE,
  venue_id UUID UNIQUE REFERENCES venues(id) ON DELETE CASCADE,
  service_id UUID UNIQUE REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT catalog_pages_one_owner CHECK (num_nonnulls(package_id, venue_id, service_id) = 1)
);
CREATE TABLE catalog_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES catalog_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  UNIQUE (page_id, sort_order)
);
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  source TEXT NOT NULL CHECK (source IN ('upload', 'external', 'sample')),
  url TEXT,
  storage_key TEXT UNIQUE,
  mime_type TEXT,
  byte_size INTEGER,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_source CHECK (
    (source = 'upload' AND storage_key IS NOT NULL AND url IS NULL AND mime_type IS NOT NULL AND byte_size IS NOT NULL AND byte_size > 0
      AND ((kind = 'image' AND byte_size <= 10485760) OR (kind = 'video' AND byte_size <= 26214400)))
    OR (source = 'external' AND url IS NOT NULL AND url LIKE 'https://%' AND storage_key IS NULL AND byte_size IS NULL)
    OR (source = 'sample' AND kind = 'image' AND url IS NOT NULL AND url IN ('/images/wedding.jpg', '/images/dinner.jpg', '/images/dessert.jpg', '/images/hero.jpg') AND storage_key IS NULL AND byte_size IS NULL)
  )
);
CREATE TABLE catalog_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES catalog_sections(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photo', 'markdown', 'video')),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  x INTEGER NOT NULL CHECK (x >= 0 AND x < 12),
  y INTEGER NOT NULL CHECK (y >= 0),
  w INTEGER NOT NULL CHECK (w > 0 AND w <= 12),
  h INTEGER NOT NULL CHECK (h > 0 AND h <= 100),
  markdown TEXT NOT NULL DEFAULT '',
  media_id UUID REFERENCES media_assets(id) ON DELETE RESTRICT,
  alt TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  CONSTRAINT catalog_widgets_bounds CHECK (x + w <= 12),
  CONSTRAINT catalog_widgets_content CHECK (
    (type = 'markdown' AND length(trim(markdown)) > 0 AND media_id IS NULL)
    OR (type IN ('photo', 'video') AND media_id IS NOT NULL AND markdown = '')
  ),
  UNIQUE (section_id, sort_order)
);
CREATE INDEX catalog_widgets_media_id_idx ON catalog_widgets(media_id);
COMMIT;
