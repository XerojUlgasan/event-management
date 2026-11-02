ALTER TABLE service_versions DROP COLUMN categories, ADD COLUMN hourly_rate_pesos INTEGER;
ALTER TABLE service_versions ADD CONSTRAINT service_versions_hourly_rate_positive CHECK (hourly_rate_pesos IS NULL OR hourly_rate_pesos > 0);
-- Preserve existing published versions with unknown rates. New writes must satisfy this constraint.
ALTER TABLE service_versions ADD CONSTRAINT service_versions_published_hourly_rate CHECK (state <> 'published' OR hourly_rate_pesos IS NOT NULL) NOT VALID;
