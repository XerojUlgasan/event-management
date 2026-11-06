BEGIN;

-- Admin-managed package inclusions. The join is intentionally independent of
-- the dropped version-based package_services table: packages and services are
-- flat records now, and this table owns only the current assignment.
CREATE TABLE package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('included', 'optional')),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT package_services_package_id_service_id_key UNIQUE (package_id, service_id),
  CONSTRAINT package_services_package_id_sort_order_key UNIQUE (package_id, sort_order)
);

CREATE INDEX package_services_service_id_idx ON package_services(service_id);

COMMIT;
