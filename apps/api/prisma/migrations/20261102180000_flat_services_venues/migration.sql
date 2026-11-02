BEGIN;

-- Stop older API transactions from changing the selected content mid-migration.
LOCK TABLE services, venues, service_versions, venue_versions IN ACCESS EXCLUSIVE MODE;

-- Keep the currently public content. If a listing has never been published,
-- preserve its latest content in Archives instead of making a draft public.
-- Back up version history before deploying: historical/unselected pages are
-- removed by this migration; uploaded media objects are not deleted here.
CREATE TEMP TABLE chosen_services ON COMMIT DROP AS
SELECT DISTINCT ON (service_id) * FROM service_versions
ORDER BY service_id, (state = 'published') DESC, version DESC;
CREATE TEMP TABLE chosen_venues ON COMMIT DROP AS
SELECT DISTINCT ON (venue_id) * FROM venue_versions
ORDER BY venue_id, (state = 'published') DESC, version DESC;

ALTER TABLE services
  ADD COLUMN name TEXT NOT NULL DEFAULT '',
  ADD COLUMN description TEXT NOT NULL DEFAULT '',
  ADD COLUMN hourly_rate_pesos INTEGER,
  ADD COLUMN image_id UUID,
  ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD CONSTRAINT services_hourly_rate_positive CHECK (hourly_rate_pesos IS NULL OR hourly_rate_pesos > 0);
UPDATE services s SET
  name = c.name, description = c.description,
  hourly_rate_pesos = c.hourly_rate_pesos, image_id = c.image_id,
  published_at = COALESCE(c.published_at, s.created_at),
  updated_at = GREATEST(s.updated_at, c.updated_at),
  archived_at = COALESCE(s.archived_at, CASE WHEN c.state <> 'published' THEN now() END)
FROM chosen_services c WHERE c.service_id = s.id;
UPDATE services SET archived_at = COALESCE(archived_at, now())
WHERE NOT EXISTS (SELECT 1 FROM chosen_services c WHERE c.service_id = services.id);
ALTER TABLE services ALTER COLUMN name DROP DEFAULT, ALTER COLUMN description DROP DEFAULT;

ALTER TABLE venues
  ADD COLUMN name TEXT NOT NULL DEFAULT '',
  ADD COLUMN location TEXT NOT NULL DEFAULT '',
  ADD COLUMN description TEXT NOT NULL DEFAULT '',
  ADD COLUMN categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN capacity_max INTEGER,
  ADD COLUMN image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD CONSTRAINT venues_capacity_positive CHECK (capacity_max IS NULL OR capacity_max > 0);
UPDATE venues v SET
  name = c.name, location = c.location, description = c.description,
  categories = c.categories, capacity_max = c.capacity_max, image_urls = c.image_urls,
  published_at = COALESCE(c.published_at, v.created_at),
  updated_at = GREATEST(v.updated_at, c.updated_at),
  archived_at = COALESCE(v.archived_at, CASE WHEN c.state <> 'published' THEN now() END)
FROM chosen_venues c WHERE c.venue_id = v.id;
UPDATE venues SET archived_at = COALESCE(archived_at, now())
WHERE NOT EXISTS (SELECT 1 FROM chosen_venues c WHERE c.venue_id = venues.id);
ALTER TABLE venues ALTER COLUMN name DROP DEFAULT, ALTER COLUMN location DROP DEFAULT,
  ALTER COLUMN description DROP DEFAULT, ALTER COLUMN categories DROP DEFAULT;

-- Retain the exact selected canvas (including widget IDs/layout and media).
DELETE FROM catalog_pages p
WHERE (service_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM chosen_services c WHERE c.id = p.service_version_id))
   OR (venue_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM chosen_venues c WHERE c.id = p.venue_version_id));
ALTER TABLE catalog_pages DROP CONSTRAINT catalog_pages_one_owner;
ALTER TABLE catalog_pages DROP COLUMN service_version_id, DROP COLUMN venue_version_id;
ALTER TABLE catalog_pages
  ADD CONSTRAINT catalog_pages_service_id_key UNIQUE (service_id),
  ADD CONSTRAINT catalog_pages_venue_id_key UNIQUE (venue_id),
  ADD CONSTRAINT catalog_pages_one_owner CHECK (num_nonnulls(package_id, service_id, venue_id) = 1);
DROP TABLE service_versions;
DROP TABLE venue_versions;

COMMIT;
