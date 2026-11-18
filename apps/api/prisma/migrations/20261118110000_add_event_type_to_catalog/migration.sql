ALTER TABLE packages
  ADD COLUMN event_type TEXT,
  ADD CONSTRAINT packages_event_type_check
    CHECK (event_type IN ('Birthday', 'Wedding', 'Debut', 'Corporate'));

ALTER TABLE services
  ADD COLUMN event_type TEXT,
  ADD CONSTRAINT services_event_type_check
    CHECK (event_type IN ('Birthday', 'Wedding', 'Debut', 'Corporate'));
