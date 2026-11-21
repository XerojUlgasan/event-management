BEGIN;

ALTER TABLE booking_requests
  ADD COLUMN submitted_at timestamptz(6),
  ADD COLUMN duration_mode text CHECK (duration_mode IN ('one_day', 'multi_day')),
  ADD COLUMN requested_services jsonb CHECK (jsonb_typeof(requested_services) = 'array'),
  ADD COLUMN budget text,
  ALTER COLUMN customer_id DROP NOT NULL,
  ALTER COLUMN event_type DROP NOT NULL,
  ALTER COLUMN preferred_date DROP NOT NULL,
  ALTER COLUMN time_zone DROP NOT NULL,
  ALTER COLUMN contact_name DROP NOT NULL,
  ALTER COLUMN phone_number DROP NOT NULL;

-- Each prior booking was already submitted, including requests predating requested_days.
UPDATE booking_requests
SET submitted_at = created_at,
    duration_mode = CASE WHEN requested_days IS NULL THEN NULL
                         WHEN jsonb_array_length(requested_days) = 1 THEN 'one_day' ELSE 'multi_day' END,
    requested_services = intake_details->'requestedServices',
    budget = intake_details->>'budget',
    special_requests = NULLIF(concat_ws(E'\n', special_requests, intake_details->>'preferences'), '');

ALTER TABLE booking_requests
  ALTER COLUMN submitted_at SET DEFAULT now(),
  ADD CONSTRAINT booking_requests_submitted_fields_check CHECK (
    submitted_at IS NULL OR (customer_id IS NOT NULL AND event_type IS NOT NULL
      AND preferred_date IS NOT NULL AND time_zone IS NOT NULL AND contact_name IS NOT NULL AND phone_number IS NOT NULL)
  );

ALTER TABLE conversations DROP CONSTRAINT conversations_owner_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_owner_check CHECK (
  (customer_id IS NOT NULL AND guest_identity_id IS NULL)
  OR (customer_id IS NULL AND guest_identity_id IS NOT NULL AND claimed_guest_identity_id IS NULL)
);

-- Reuse the existing unique conversation link; keep active guests anonymous until claim.
WITH drafts AS MATERIALIZED (
  SELECT c.id AS conversation_id, gen_random_uuid() AS id, c.customer_id, d.payload,
         p.id AS package_id,
         (SELECT jsonb_agg(jsonb_build_object('date', day, 'startsAt', NULL, 'endsAt', NULL) ORDER BY day)
          FROM jsonb_array_elements_text(d.payload->'requestedDates') AS days(day)) AS days
  FROM conversation_booking_drafts d JOIN conversations c ON c.id = d.conversation_id
  LEFT JOIN packages p ON p.id = (d.payload->>'packageId')::uuid AND p.package_type = 'catalog'
  WHERE d.status IN ('collecting','awaiting_confirmation') AND c.booking_request_id IS NULL
), inserted AS (
  INSERT INTO booking_requests (id, reference, customer_id, package_id, event_type, preferred_date,
    requested_days, duration_mode, time_zone, guest_count, contact_name, phone_number,
    preferred_venue_location, special_requests, requested_services, budget, out_of_range, submitted_at)
  SELECT id, 'BR-' || upper(id::text), customer_id, package_id, payload->>'eventType', days->0->>'date',
    days, payload->>'durationMode', payload->>'timeZone', (payload->>'guestCount')::integer,
    payload->>'contactName', payload->>'phoneNumber', payload->>'preferredVenueLocation',
    NULLIF(concat_ws(E'\n', payload->>'specialRequests', payload->>'preferences',
      CASE WHEN payload ? 'packageId' AND package_id IS NULL THEN 'Previously selected package unavailable. Please choose again.' END), ''),
    payload->'requestedServices', payload->>'budget', false, NULL
  FROM drafts RETURNING id
)
UPDATE conversations c SET booking_request_id = i.id
FROM inserted i JOIN drafts d ON i.id = d.id WHERE c.id = d.conversation_id;

-- Preserve what customers previously saw in historical structured reviews as ordinary chat text.
UPDATE messages m SET body = concat_ws(E'\n',
  'Booking request summary', 'Event: ' || (r->'fields'->>'eventType'),
  'Duration: ' || (r->'fields'->>'durationMode'),
  'Dates: ' || (SELECT string_agg(day, ', ' ORDER BY day) FROM jsonb_array_elements_text(r->'fields'->'requestedDates') AS days(day)),
  'Time zone: ' || (r->'fields'->>'timeZone'), 'Contact: ' || (r->'fields'->>'contactName'),
  'Phone: ' || (r->'fields'->>'phoneNumber'), 'Guests: ' || (r->'fields'->>'guestCount'),
  'Venue: ' || (r->'fields'->>'preferredVenueLocation'),
  'Package: ' || coalesce(r->'selectedPackage'->>'name', 'No package selected'),
  'Package price (PHP): ' || (r->'selectedPackage'->>'pricePesos'),
  'Maximum guests: ' || (r->'selectedPackage'->>'maxGuests'),
  (SELECT string_agg(concat_ws(' · ', item->>'name', CASE WHEN (item->>'included')::boolean THEN 'Included in package' END,
            (item->>'hours') || ' hours', item->>'notes'), E'\n' ORDER BY position)
   FROM jsonb_array_elements(r->'requestedServices') WITH ORDINALITY AS services(item, position)),
  'Budget: ' || (r->'fields'->>'budget'), r->'fields'->>'preferences', r->'fields'->>'specialRequests',
  (SELECT string_agg(warning, E'\n') FROM jsonb_array_elements_text(r->'warnings') AS warnings(warning)), m.body)
FROM (SELECT id, booking_review AS r FROM messages WHERE booking_review IS NOT NULL) old
WHERE m.id = old.id;

DROP TABLE conversation_booking_drafts;
ALTER TABLE messages DROP COLUMN booking_review, DROP COLUMN booking_review_reply_to;
ALTER TABLE booking_requests DROP COLUMN intake_details;

COMMIT;
