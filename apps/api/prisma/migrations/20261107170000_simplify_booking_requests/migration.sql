BEGIN;

-- Prevent concurrent edits between copying arrangements and removing their table.
LOCK TABLE booking_requests, booking_arrangements, quotation_items,
  customization_requests IN ACCESS EXCLUSIVE MODE;

-- Keep internal notes separate from the customer's original special requests.
-- The editor is nullable for requests that do not have an arrangement.
ALTER TABLE booking_requests
  ADD COLUMN notes TEXT,
  ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE RESTRICT;

UPDATE booking_requests AS request
SET event_type = arrangement.event_type,
    preferred_date = arrangement.preferred_date,
    estimated_duration = arrangement.estimated_duration,
    estimated_duration_days = arrangement.estimated_duration_days,
    starts_at = arrangement.starts_at,
    ends_at = arrangement.ends_at,
    guest_count = arrangement.guest_count,
    preferred_venue_location = arrangement.preferred_venue_location,
    notes = arrangement.notes,
    updated_by = arrangement.updated_by,
    updated_at = GREATEST(request.updated_at, arrangement.updated_at)
FROM booking_arrangements AS arrangement
WHERE arrangement.booking_request_id = request.id;

-- PostgreSQL also removes this column's foreign key and single-column index.
-- All quotation item amounts, directions, ordering and other links are retained.
ALTER TABLE quotation_items DROP COLUMN customization_request_id;

DROP TABLE customization_requests;
DROP TABLE booking_arrangements;

-- Timestamptz values retain their instants; preferred_date remains a date string.
-- package_id and its restrictive foreign key remain the package reference.
ALTER TABLE booking_requests
  DROP COLUMN package_name,
  DROP COLUMN package_price,
  DROP COLUMN package_max_guests,
  DROP COLUMN package_inclusions_snapshot,
  DROP COLUMN time_zone;

COMMIT;
