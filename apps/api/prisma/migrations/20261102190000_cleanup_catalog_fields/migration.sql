BEGIN;

-- Rename in place to retain guest limits, including historical inquiry snapshots.
ALTER TABLE packages RENAME COLUMN guest_max TO max_guests;
ALTER TABLE packages RENAME CONSTRAINT packages_guest_max_check TO packages_max_guests_check;
ALTER TABLE venues RENAME COLUMN capacity_max TO max_guests;
ALTER TABLE venues RENAME CONSTRAINT venues_capacity_positive TO venues_max_guests_check;
ALTER TABLE booking_requests RENAME COLUMN package_guest_max TO package_max_guests;
ALTER TABLE booking_requests RENAME CONSTRAINT booking_requests_package_guest_max_check TO booking_requests_package_max_guests_check;

-- Catalog photos now belong exclusively to canvas widgets/media_assets.
-- Deliberately discard obsolete metadata; retain all records and canvas content.
-- This migration does not delete any uploaded storage objects.
ALTER TABLE packages DROP COLUMN event_types;
ALTER TABLE venues DROP COLUMN categories, DROP COLUMN image_urls;
ALTER TABLE services DROP COLUMN image_id;

COMMIT;
