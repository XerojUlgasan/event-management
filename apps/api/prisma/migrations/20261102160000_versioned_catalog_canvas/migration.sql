-- Each service or venue version has its own page; preserve existing catalogs.
ALTER TABLE catalog_pages DROP CONSTRAINT catalog_pages_one_owner;
ALTER TABLE catalog_pages DROP CONSTRAINT catalog_pages_venue_id_key;
ALTER TABLE catalog_pages DROP CONSTRAINT catalog_pages_service_id_key;
ALTER TABLE catalog_pages
  ADD COLUMN venue_version_id UUID UNIQUE REFERENCES venue_versions(id) ON DELETE CASCADE,
  ADD COLUMN service_version_id UUID UNIQUE REFERENCES service_versions(id) ON DELETE CASCADE;
-- No versioned pages existed in the prior implementation. Refuse to orphan any
-- unexpected data rather than guessing which version owns it.
ALTER TABLE catalog_pages ADD CONSTRAINT catalog_pages_one_owner CHECK (
  (package_id IS NOT NULL AND venue_id IS NULL AND service_id IS NULL AND venue_version_id IS NULL AND service_version_id IS NULL)
  OR (package_id IS NULL AND venue_id IS NOT NULL AND venue_version_id IS NOT NULL AND service_id IS NULL AND service_version_id IS NULL)
  OR (package_id IS NULL AND service_id IS NOT NULL AND service_version_id IS NOT NULL AND venue_id IS NULL AND venue_version_id IS NULL)
);
ALTER TABLE venue_versions ADD CONSTRAINT venue_versions_id_venue_unique UNIQUE (id, venue_id);
ALTER TABLE service_versions ADD CONSTRAINT service_versions_id_service_unique UNIQUE (id, service_id);
ALTER TABLE catalog_pages ADD CONSTRAINT catalog_pages_venue_version_owner FOREIGN KEY (venue_version_id, venue_id) REFERENCES venue_versions(id, venue_id) ON DELETE CASCADE;
ALTER TABLE catalog_pages ADD CONSTRAINT catalog_pages_service_version_owner FOREIGN KEY (service_version_id, service_id) REFERENCES service_versions(id, service_id) ON DELETE CASCADE;
-- The service publication rule also accepts a canvas photo, checked by the API.
ALTER TABLE service_versions DROP CONSTRAINT service_versions_published_image;
