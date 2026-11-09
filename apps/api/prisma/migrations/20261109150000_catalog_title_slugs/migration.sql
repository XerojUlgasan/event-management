BEGIN;

CREATE OR REPLACE FUNCTION clemora_catalog_slug(input text) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  value text := lower(coalesce(input, ''));
BEGIN
  value := translate(value, 'àáâãäåèéêëìíîïòóôõöùúûüýñç', 'aaaaaaeeeeiiiioooooouuuuync');
  value := regexp_replace(value, '[^a-z0-9]+', '-', 'g');
  value := regexp_replace(value, '(^-+|-+$)', '', 'g');
  value := left(value, 80);
  IF value = '' THEN
    value := 'item';
  END IF;
  RETURN value;
END;
$$;

ALTER TABLE packages ADD COLUMN slug text;
ALTER TABLE services ADD COLUMN slug text;
ALTER TABLE venues ADD COLUMN slug text;

-- Titles that differ only by case cannot share a public address.
UPDATE packages AS item
SET name = item.name || ' ' || numbered.n
FROM (
  SELECT id, row_number() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS n
  FROM packages
) AS numbered
WHERE item.id = numbered.id AND numbered.n > 1;

UPDATE services AS item
SET name = item.name || ' ' || numbered.n
FROM (
  SELECT id, row_number() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS n
  FROM services
) AS numbered
WHERE item.id = numbered.id AND numbered.n > 1;

UPDATE venues AS item
SET name = item.name || ' ' || numbered.n
FROM (
  SELECT id, row_number() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS n
  FROM venues
) AS numbered
WHERE item.id = numbered.id AND numbered.n > 1;

UPDATE packages AS item
SET slug = CASE WHEN numbered.n = 1 THEN numbered.base ELSE numbered.base || '-' || numbered.n END
FROM (
  SELECT id, clemora_catalog_slug(name) AS base,
         row_number() OVER (PARTITION BY clemora_catalog_slug(name) ORDER BY created_at, id) AS n
  FROM packages
) AS numbered
WHERE item.id = numbered.id;

UPDATE services AS item
SET slug = CASE WHEN numbered.n = 1 THEN numbered.base ELSE numbered.base || '-' || numbered.n END
FROM (
  SELECT id, clemora_catalog_slug(name) AS base,
         row_number() OVER (PARTITION BY clemora_catalog_slug(name) ORDER BY created_at, id) AS n
  FROM services
) AS numbered
WHERE item.id = numbered.id;

UPDATE venues AS item
SET slug = CASE WHEN numbered.n = 1 THEN numbered.base ELSE numbered.base || '-' || numbered.n END
FROM (
  SELECT id, clemora_catalog_slug(name) AS base,
         row_number() OVER (PARTITION BY clemora_catalog_slug(name) ORDER BY created_at, id) AS n
  FROM venues
) AS numbered
WHERE item.id = numbered.id;

ALTER TABLE packages ALTER COLUMN slug SET NOT NULL;
ALTER TABLE services ALTER COLUMN slug SET NOT NULL;
ALTER TABLE venues ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX packages_slug_key ON packages (slug);
CREATE UNIQUE INDEX services_slug_key ON services (slug);
CREATE UNIQUE INDEX venues_slug_key ON venues (slug);
CREATE UNIQUE INDEX packages_name_lower_key ON packages (lower(name));
CREATE UNIQUE INDEX services_name_lower_key ON services (lower(name));
CREATE UNIQUE INDEX venues_name_lower_key ON venues (lower(name));

DROP FUNCTION clemora_catalog_slug(text);

COMMIT;
