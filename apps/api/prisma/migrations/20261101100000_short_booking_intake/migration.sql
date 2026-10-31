ALTER TABLE booking_requests
  ADD COLUMN preferred_date TEXT,
  ADD COLUMN estimated_duration TEXT NOT NULL DEFAULT 'undecided',
  ALTER COLUMN starts_at DROP NOT NULL,
  ALTER COLUMN ends_at DROP NOT NULL,
  ALTER COLUMN preferred_venue_location DROP NOT NULL;

-- Preserve the date as seen in the time zone supplied with each original request.
UPDATE booking_requests
SET preferred_date = to_char(starts_at AT TIME ZONE time_zone, 'YYYY-MM-DD');

ALTER TABLE booking_requests
  ALTER COLUMN preferred_date SET NOT NULL,
  ADD CONSTRAINT booking_requests_estimated_duration_check
    CHECK (estimated_duration IN ('4_hours', '8_hours', '12_hours', '1_day', '2_days', 'undecided'));
