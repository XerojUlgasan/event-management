-- Canvas document rules belong to the shared application schema, used by the
-- editor, API, stored-document readers/writers, and seeds. Preserve the JSONB
-- columns, defaults, NOT NULL constraints, data, and media-reference indexes.
BEGIN;
ALTER TABLE packages DROP CONSTRAINT packages_canvas_valid;
ALTER TABLE services DROP CONSTRAINT services_canvas_valid;
DROP FUNCTION catalog_canvas_is_valid(JSONB);
COMMIT;
