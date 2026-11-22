BEGIN;

-- Keep the legacy sources stable until the backfill and column removal commit.
LOCK TABLE public.booking_requests, public.packages, public.quotations IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION pg_temp.positive_whole(value jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN
    CASE WHEN n BETWEEN 1 AND 2147483647 AND trunc(n) = n THEN n END
  END
  FROM (SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END AS n) AS number;
$$;

CREATE FUNCTION pg_temp.valid_service_pricing(pricing jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT CASE WHEN jsonb_typeof(pricing) = 'object' THEN
    pricing ?& ARRAY['fixedPricePesos', 'includedHours', 'hourlyRatePesos']
    AND pricing - ARRAY['fixedPricePesos', 'includedHours', 'hourlyRatePesos'] = '{}'::jsonb
    AND pg_temp.positive_whole(pricing->'hourlyRatePesos') IS NOT NULL
    AND (
      (pricing->'fixedPricePesos' = 'null'::jsonb AND pricing->'includedHours' = 'null'::jsonb)
      OR (pg_temp.positive_whole(pricing->'fixedPricePesos') IS NOT NULL
          AND pg_temp.positive_whole(pricing->'includedHours') IS NOT NULL)
    )
  ELSE false END;
$$;

-- Stage the source rows once so validation and the backfill use the same service metadata.
CREATE TEMP TABLE legacy_booking_addons ON COMMIT DROP AS
SELECT p.id AS package_id, p.custom_for_booking_request_id AS booking_id,
       addon.value AS item, addon.position,
       lower(addon.value->>'id') AS addon_id,
       lower(addon.value->>'serviceId') AS service_id,
       s.name AS service_name, s.updated_at AS service_updated_at,
       jsonb_build_object(
         'fixedPricePesos', addon.value->'fixedPricePesos',
         'includedHours', addon.value->'includedHours',
         'hourlyRatePesos', addon.value->'hourlyRatePesos'
       ) AS pricing
FROM public.packages p
CROSS JOIN LATERAL jsonb_array_elements(p.addon_services) WITH ORDINALITY AS addon(value, position)
LEFT JOIN public.services s ON s.id = CASE
  WHEN addon.value->>'serviceId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN (addon.value->>'serviceId')::uuid END;

DO $$
DECLARE
  uuid_pattern constant text := '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_temp.legacy_booking_addons a
    LEFT JOIN public.booking_requests b ON b.id = a.booking_id
    WHERE b.submitted_at IS NULL OR a.service_name IS NULL OR a.position > 100
       OR jsonb_typeof(a.item) IS DISTINCT FROM 'object'
       OR NOT (a.item ?& ARRAY['id', 'serviceId', 'fixedPricePesos', 'includedHours', 'hourlyRatePesos'])
       OR a.addon_id IS NULL OR a.addon_id !~ uuid_pattern
       OR a.service_id IS NULL OR a.service_id !~ uuid_pattern
       OR pg_temp.valid_service_pricing(a.pricing) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Cannot migrate invalid private-package add-on sources';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_temp.legacy_booking_addons
    GROUP BY booking_id
    HAVING count(*) <> count(DISTINCT addon_id) OR count(*) <> count(DISTINCT service_id)
  ) THEN
    RAISE EXCEPTION 'Cannot migrate ambiguous private-package add-on sources';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.booking_requests b
    CROSS JOIN LATERAL jsonb_array_elements(b.requested_services) AS intake(item)
    WHERE b.submitted_at IS NOT NULL AND CASE
      WHEN jsonb_typeof(intake.item) IS DISTINCT FROM 'object' THEN true
      ELSE NOT (intake.item ?& ARRAY['serviceId', 'name', 'hours', 'notes', 'included', 'updatedAt'])
      OR intake.item - ARRAY['serviceId', 'name', 'hours', 'notes', 'included', 'updatedAt', 'catalogPricing'] <> '{}'::jsonb
      OR (intake.item->'serviceId' <> 'null'::jsonb AND (
        jsonb_typeof(intake.item->'serviceId') IS DISTINCT FROM 'string'
        OR lower(intake.item->>'serviceId') !~ uuid_pattern
      ))
      OR jsonb_typeof(intake.item->'name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(intake.item->'hours') NOT IN ('number', 'null')
      OR CASE WHEN jsonb_typeof(intake.item->'hours') = 'number'
              THEN abs((intake.item->>'hours')::numeric) > 1.7976931348623157e308
              ELSE false END
      OR jsonb_typeof(intake.item->'notes') NOT IN ('string', 'null')
      OR jsonb_typeof(intake.item->'included') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(intake.item->'updatedAt') NOT IN ('string', 'null')
      OR (intake.item ? 'catalogPricing'
          AND pg_temp.valid_service_pricing(intake.item->'catalogPricing') IS NOT TRUE)
    END
  ) THEN
    RAISE EXCEPTION 'Cannot migrate malformed submitted requested services';
  END IF;
END;
$$;

WITH delivered AS NOT MATERIALIZED (
  SELECT q.booking_request_id, q.items, q.version
  FROM public.quotations q
  WHERE q.sent_at IS NOT NULL AND q.status IN ('sent', 'superseded')
), submitted AS (
  SELECT b.id, b.requested_services, p.id AS package_id,
         EXISTS (SELECT 1 FROM delivered q WHERE q.booking_request_id = b.id) AS has_delivery
  FROM public.booking_requests b
  LEFT JOIN public.packages p ON p.custom_for_booking_request_id = b.id
  WHERE b.submitted_at IS NOT NULL
    AND (jsonb_array_length(b.requested_services) > 0 OR p.addon_services <> '[]'::jsonb)
), intake_rows AS (
  SELECT b.id AS booking_id, b.package_id, b.has_delivery, service.item, service.position,
         lower(service.item->>'serviceId') AS service_id,
         pg_temp.positive_whole(service.item->'hours') AS hours
  FROM submitted b
  CROSS JOIN LATERAL jsonb_array_elements(b.requested_services) WITH ORDINALITY AS service(item, position)
), intake AS (
  SELECT i.*,
         row_number() OVER (PARTITION BY booking_id, service_id ORDER BY position) AS occurrence,
         count(*) FILTER (
           WHERE i.service_id IS NOT NULL AND i.item->'included' = 'false'::jsonb
             AND i.hours IS NOT NULL AND pg_temp.valid_service_pricing(i.item->'catalogPricing')
         ) OVER (PARTITION BY booking_id, service_id ORDER BY position) AS manual_occurrence
  FROM intake_rows i
), private_offers AS (
  SELECT a.*, jsonb_build_object('totalHours',
           coalesce(pg_temp.positive_whole(to_jsonb(quote.total_hours)), intake.hours)
         ) || a.pricing AS offer
  FROM pg_temp.legacy_booking_addons a
  LEFT JOIN intake ON intake.booking_id = a.booking_id
    AND intake.service_id = a.service_id AND intake.occurrence = 1
  LEFT JOIN LATERAL (
    -- A fixed-price legacy line counted excess hours, while hourly-only lines counted total hours.
    SELECT coalesce((line.item#>>'{addon,source,includedHours}')::numeric, 0)
             + (line.item#>>'{addon,hours}')::numeric AS total_hours
    FROM delivered q
    CROSS JOIN LATERAL jsonb_array_elements(q.items) AS line(item)
    WHERE q.booking_request_id = a.booking_id
      AND lower(line.item->>'serviceId') = a.service_id
      AND lower(line.item#>>'{addon,source,packageId}') = a.package_id::text
      AND lower(line.item#>>'{addon,source,addonId}') = a.addon_id
    ORDER BY q.version DESC
    LIMIT 1
  ) quote ON true
), entries AS (
  SELECT i.booking_id, false AS admin_only, i.position,
         i.item || jsonb_build_object('id', coalesce(a.addon_id, gen_random_uuid()::text))
           || CASE WHEN i.service_id IS NOT NULL
                   THEN jsonb_build_object('serviceId', i.service_id) ELSE '{}'::jsonb END
           || CASE WHEN a.offer IS NOT NULL THEN jsonb_build_object('offer', a.offer)
                   WHEN i.package_id IS NULL AND NOT i.has_delivery AND i.service_id IS NOT NULL
                     AND i.item->'included' = 'false'::jsonb AND i.hours IS NOT NULL
                     AND pg_temp.valid_service_pricing(i.item->'catalogPricing') AND i.manual_occurrence = 1
                   THEN jsonb_build_object('offer',
                     jsonb_build_object('totalHours', i.hours) || (i.item->'catalogPricing'))
                   ELSE '{}'::jsonb END AS item
  FROM intake i
  LEFT JOIN private_offers a ON a.booking_id = i.booking_id
    AND a.service_id = i.service_id AND i.occurrence = 1

  UNION ALL

  SELECT a.booking_id, true, a.position,
         jsonb_build_object('id', a.addon_id, 'serviceId', a.service_id, 'origin', 'admin',
           'name', a.service_name, 'hours', NULL, 'notes', NULL, 'included', false,
           'updatedAt', to_char(a.service_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'offer', a.offer)
  FROM private_offers a
  WHERE NOT EXISTS (
    SELECT 1 FROM intake i WHERE i.booking_id = a.booking_id AND i.service_id = a.service_id
  )
), backfill AS (
  SELECT booking_id, jsonb_agg(item ORDER BY admin_only, position) AS services
  FROM entries GROUP BY booking_id
)
UPDATE public.booking_requests b
SET requested_services = backfill.services,
    updated_at = greatest(clock_timestamp(), b.updated_at + interval '1 microsecond')
FROM backfill WHERE b.id = backfill.booking_id;

CREATE INDEX booking_requests_requested_services_idx
  ON public.booking_requests USING gin (requested_services jsonb_path_ops);

ALTER TABLE public.packages DROP COLUMN addon_services;

DROP FUNCTION pg_temp.valid_service_pricing(jsonb);
DROP FUNCTION pg_temp.positive_whole(jsonb);

COMMIT;
