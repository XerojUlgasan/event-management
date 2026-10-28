-- Add event_start_time, event_end_time, event_type, venue_name to bookings
ALTER TABLE "bookings"
  ADD COLUMN "event_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
  ADD COLUMN "event_end_time"   VARCHAR(5) NOT NULL DEFAULT '18:00',
  ADD COLUMN "event_type"       TEXT       NOT NULL DEFAULT 'other',
  ADD COLUMN "venue_name"       TEXT       NOT NULL DEFAULT '';

-- Remove temporary defaults (columns are required, populated by application)
ALTER TABLE "bookings"
  ALTER COLUMN "event_start_time" DROP DEFAULT,
  ALTER COLUMN "event_end_time"   DROP DEFAULT,
  ALTER COLUMN "event_type"       DROP DEFAULT,
  ALTER COLUMN "venue_name"       DROP DEFAULT;
