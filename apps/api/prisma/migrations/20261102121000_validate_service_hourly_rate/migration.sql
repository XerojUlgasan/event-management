-- Block release until every existing published service version has an hourly rate.
ALTER TABLE service_versions VALIDATE CONSTRAINT service_versions_published_hourly_rate;
