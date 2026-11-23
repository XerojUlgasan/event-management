ALTER TABLE packages
  ADD COLUMN addon_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT packages_addon_services_array CHECK (jsonb_typeof(addon_services) = 'array'),
  ADD CONSTRAINT packages_catalog_no_addon_services CHECK (package_type = 'custom' OR addon_services = '[]'::jsonb);

CREATE INDEX packages_addon_services_idx ON packages USING gin (addon_services jsonb_path_ops);
