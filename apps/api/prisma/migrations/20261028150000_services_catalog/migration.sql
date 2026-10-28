CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, archived_at TIMESTAMPTZ(6)
);
CREATE TABLE service_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0), state TEXT NOT NULL CHECK (state IN ('draft', 'published', 'superseded')),
  name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, coverage TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes > 0), setup_minutes INTEGER CHECK (setup_minutes >= 0), setup_needs TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMPTZ(6), UNIQUE (service_id, version),
  CHECK ((state = 'draft' AND published_at IS NULL) OR (state IN ('published', 'superseded') AND published_at IS NOT NULL))
);
CREATE UNIQUE INDEX service_versions_one_draft ON service_versions(service_id) WHERE state = 'draft';
CREATE UNIQUE INDEX service_versions_one_published ON service_versions(service_id) WHERE state = 'published';
CREATE TABLE package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), package_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
  service_version_id UUID NOT NULL REFERENCES service_versions(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('included', 'add_on')), included_quantity INTEGER, add_on_unit_price_amount_minor INTEGER, add_on_max_quantity INTEGER,
  CHECK ((role = 'included' AND included_quantity IS NOT NULL AND included_quantity > 0 AND add_on_unit_price_amount_minor IS NULL AND add_on_max_quantity IS NULL) OR
         (role = 'add_on' AND included_quantity IS NULL AND add_on_unit_price_amount_minor IS NOT NULL AND add_on_unit_price_amount_minor > 0 AND add_on_max_quantity IS NOT NULL AND add_on_max_quantity > 0)),
  UNIQUE (package_version_id, service_version_id)
);
