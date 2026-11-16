-- Keep each canvas with its package or service. Preserve child IDs and display
-- order before removing the former page/section/widget storage hierarchy.
BEGIN;
ALTER TABLE packages ADD COLUMN canvas JSONB NOT NULL DEFAULT '[]';
ALTER TABLE services ADD COLUMN canvas JSONB NOT NULL DEFAULT '[]';

WITH canvases AS (
  SELECT p.package_id, p.service_id,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'title', s.title, 'widgets', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', w.id, 'type', w.type,
          'x', w.x, 'y', w.y, 'w', w.w, 'h', w.h,
          'markdown', w.markdown, 'mediaId', w.media_id,
          'alt', w.alt, 'caption', w.caption, 'autoplay', w.autoplay
        ) ORDER BY w.sort_order), '[]'::jsonb)
        FROM catalog_widgets w WHERE w.section_id = s.id
      )
    ) ORDER BY s.sort_order) FILTER (WHERE s.id IS NOT NULL), '[]'::jsonb) AS canvas
  FROM catalog_pages p LEFT JOIN catalog_sections s ON s.page_id = p.id
  GROUP BY p.id
)
UPDATE packages SET canvas = c.canvas FROM canvases c WHERE packages.id = c.package_id;

WITH canvases AS (
  SELECT p.service_id,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'title', s.title, 'widgets', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', w.id, 'type', w.type,
          'x', w.x, 'y', w.y, 'w', w.w, 'h', w.h,
          'markdown', w.markdown, 'mediaId', w.media_id,
          'alt', w.alt, 'caption', w.caption, 'autoplay', w.autoplay
        ) ORDER BY w.sort_order), '[]'::jsonb)
        FROM catalog_widgets w WHERE w.section_id = s.id
      )
    ) ORDER BY s.sort_order) FILTER (WHERE s.id IS NOT NULL), '[]'::jsonb) AS canvas
  FROM catalog_pages p LEFT JOIN catalog_sections s ON s.page_id = p.id
  WHERE p.service_id IS NOT NULL GROUP BY p.id
)
UPDATE services SET canvas = c.canvas FROM canvases c WHERE services.id = c.service_id;

-- JSON syntax alone is insufficient: retain structural/layout/content checks.
-- References to media_assets are validated under row locks by the API, including
-- cleanup. Media metadata and uploaded bytes stay outside the canvas document.
CREATE FUNCTION catalog_canvas_is_valid(document JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE AS $$
DECLARE
  section JSONB;
  widget JSONB;
  field TEXT;
  section_ids TEXT[] := '{}';
  widget_ids TEXT[] := '{}';
  uuid_pattern CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF jsonb_typeof(document) <> 'array' OR jsonb_array_length(document) > 20 THEN RETURN FALSE; END IF;
  FOR section IN SELECT value FROM jsonb_array_elements(document) LOOP
    IF jsonb_typeof(section) <> 'object'
      OR NOT section ?& ARRAY['id','title','widgets']
      OR section - ARRAY['id','title','widgets'] <> '{}'::jsonb
      OR jsonb_typeof(section->'id') <> 'string'
      OR (section->>'id') !~ uuid_pattern
      OR section->>'id' = ANY(section_ids)
      OR jsonb_typeof(section->'title') <> 'string'
      OR length(section->>'title') > 4000
      OR jsonb_typeof(section->'widgets') <> 'array'
    THEN RETURN FALSE; END IF;
    section_ids := array_append(section_ids, section->>'id');
    FOR widget IN SELECT value FROM jsonb_array_elements(section->'widgets') LOOP
      IF jsonb_typeof(widget) <> 'object'
        OR NOT widget ?& ARRAY['id','type','x','y','w','h','markdown','mediaId','alt','caption','autoplay']
        OR widget - ARRAY['id','type','x','y','w','h','markdown','mediaId','alt','caption','autoplay'] <> '{}'::jsonb
        OR jsonb_typeof(widget->'id') <> 'string'
        OR (widget->>'id') !~ uuid_pattern
        OR widget->>'id' = ANY(widget_ids)
        OR jsonb_typeof(widget->'type') <> 'string'
        OR widget->>'type' NOT IN ('photo','markdown','video')
        OR jsonb_typeof(widget->'autoplay') <> 'boolean'
        OR (widget->>'autoplay' = 'true' AND widget->>'type' <> 'video')
        OR jsonb_typeof(widget->'markdown') <> 'string'
        OR length(widget->>'markdown') > 20000
        OR jsonb_typeof(widget->'alt') <> 'string' OR length(widget->>'alt') > 4000
        OR jsonb_typeof(widget->'caption') <> 'string' OR length(widget->>'caption') > 4000
      THEN RETURN FALSE; END IF;
      widget_ids := array_append(widget_ids, widget->>'id');
      IF cardinality(widget_ids) > 100 THEN RETURN FALSE; END IF;
      FOREACH field IN ARRAY ARRAY['x','y','w','h'] LOOP
        IF jsonb_typeof(widget->field) <> 'number' THEN RETURN FALSE; END IF;
        IF (widget->>field)::numeric <> trunc((widget->>field)::numeric) THEN RETURN FALSE; END IF;
      END LOOP;
      IF (widget->>'x')::numeric < 0 OR (widget->>'x')::numeric > 11
        OR (widget->>'y')::numeric < 0 OR (widget->>'y')::numeric > 100000
        OR (widget->>'w')::numeric < 1 OR (widget->>'w')::numeric > 12
        OR (widget->>'h')::numeric < 1 OR (widget->>'h')::numeric > 100
        OR (widget->>'x')::numeric + (widget->>'w')::numeric > 12
      THEN RETURN FALSE; END IF;
      IF widget->>'type' = 'markdown' THEN
        IF length(btrim(widget->>'markdown')) = 0 OR widget->'mediaId' <> 'null'::jsonb THEN RETURN FALSE; END IF;
      ELSE
        IF widget->>'markdown' <> '' OR jsonb_typeof(widget->'mediaId') <> 'string'
          OR (widget->>'mediaId') !~ lower(uuid_pattern)
          OR widget->>'mediaId' <> lower(widget->>'mediaId')
        THEN RETURN FALSE; END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN TRUE;
END;
$$;
ALTER TABLE packages ADD CONSTRAINT packages_canvas_valid CHECK (catalog_canvas_is_valid(canvas));
ALTER TABLE services ADD CONSTRAINT services_canvas_valid CHECK (catalog_canvas_is_valid(canvas));
CREATE INDEX packages_canvas_idx ON packages USING GIN (canvas jsonb_path_ops);
CREATE INDEX services_canvas_idx ON services USING GIN (canvas jsonb_path_ops);
DROP TABLE catalog_widgets;
DROP TABLE catalog_sections;
DROP TABLE catalog_pages;
COMMIT;
