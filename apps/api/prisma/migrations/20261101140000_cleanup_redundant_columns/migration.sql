BEGIN;

-- Keep the existing fixed-price API contract while storing whole PHP pesos.
-- Refuse a lossy conversion if another database has fractional-peso prices.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM package_versions
    WHERE price_amount_minor IS NOT NULL AND price_amount_minor % 100 <> 0
  ) THEN
    RAISE EXCEPTION 'Package prices with centavos must be resolved before migrating to whole pesos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM conversations AS c
    JOIN booking_requests AS br ON br.id = c.booking_request_id
    WHERE c.customer_id <> br.customer_id
  ) THEN
    RAISE EXCEPTION 'Conversation and booking request customers must match before deriving context';
  END IF;
END $$;

ALTER TABLE package_versions DROP CONSTRAINT package_versions_range_check;
ALTER TABLE package_versions RENAME COLUMN price_amount_minor TO price;

UPDATE package_versions SET price = price / 100 WHERE price IS NOT NULL;

ALTER TABLE package_versions
  ADD CONSTRAINT package_versions_guest_max_check CHECK (guest_max > 0),
  DROP COLUMN guest_min,
  DROP COLUMN venue_details,
  DROP COLUMN terms;

ALTER TABLE venue_versions
  DROP CONSTRAINT venue_versions_capacity_range,
  DROP COLUMN capacity_min;

ALTER TABLE conversations
  DROP CONSTRAINT conversations_event_range_check,
  DROP CONSTRAINT conversations_guest_count_check,
  DROP CONSTRAINT conversations_package_id_fkey,
  DROP COLUMN package_id,
  DROP COLUMN event_type,
  DROP COLUMN event_starts_at,
  DROP COLUMN event_ends_at,
  DROP COLUMN guest_count;

COMMIT;
