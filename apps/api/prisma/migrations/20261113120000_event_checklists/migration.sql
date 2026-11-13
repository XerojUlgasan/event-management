BEGIN;

-- Matches the event-checklists contract and API's complete-document validation.
CREATE FUNCTION clemora_checklist_content_valid(content jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
DECLARE task jsonb; ids uuid[] := ARRAY[]::uuid[]; task_id uuid;
  instant_pattern text := '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$';
BEGIN
  IF jsonb_typeof(content) IS DISTINCT FROM 'object' OR content - 'tasks' <> '{}'::jsonb
    OR jsonb_typeof(content->'tasks') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(content->'tasks') > 100 THEN RETURN false; END IF;
  FOR task IN SELECT value FROM jsonb_array_elements(content->'tasks') LOOP
    IF jsonb_typeof(task) IS DISTINCT FROM 'object'
      OR NOT (task ?& ARRAY['id','title','instructions','startsAt','endsAt','status','note','completedAt'])
      OR task - ARRAY['id','title','instructions','startsAt','endsAt','status','note','completedAt'] <> '{}'::jsonb THEN RETURN false; END IF;
    IF jsonb_typeof(task->'id') IS DISTINCT FROM 'string'
      OR NOT (task->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN RETURN false; END IF;
    task_id := (task->>'id')::uuid;
    IF task_id = ANY(ids) THEN RETURN false; END IF;
    ids := array_append(ids, task_id);
    IF jsonb_typeof(task->'title') IS DISTINCT FROM 'string' OR length(btrim(task->>'title')) NOT BETWEEN 1 AND 200
      OR jsonb_typeof(task->'instructions') IS DISTINCT FROM 'string' OR length(task->>'instructions') > 4000
      OR jsonb_typeof(task->'note') IS DISTINCT FROM 'string' OR length(task->>'note') > 4000
      OR jsonb_typeof(task->'status') IS DISTINCT FROM 'string' OR task->>'status' NOT IN ('pending','blocked','completed') THEN RETURN false; END IF;
    IF jsonb_typeof(task->'startsAt') IS DISTINCT FROM 'string' OR NOT (task->>'startsAt' ~ instant_pattern)
      OR jsonb_typeof(task->'endsAt') IS DISTINCT FROM 'string' OR NOT (task->>'endsAt' ~ instant_pattern)
      OR (task->>'endsAt')::timestamptz <= (task->>'startsAt')::timestamptz THEN RETURN false; END IF;
    IF task->>'status' = 'blocked' AND length(btrim(task->>'note')) = 0 THEN RETURN false; END IF;
    IF task->>'status' = 'completed' THEN
      IF jsonb_typeof(task->'completedAt') IS DISTINCT FROM 'string' OR NOT (task->>'completedAt' ~ instant_pattern)
        OR NOT isfinite((task->>'completedAt')::timestamptz) THEN RETURN false; END IF;
    ELSIF task->'completedAt' <> 'null'::jsonb THEN RETURN false;
    END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR invalid_datetime_format THEN RETURN false;
END;
$$;

CREATE TABLE event_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id uuid NOT NULL UNIQUE REFERENCES events_day(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  coordinator_id uuid REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  sent_by uuid REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  sent_at timestamptz(6),
  content jsonb NOT NULL DEFAULT '{"tasks":[]}'::jsonb,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  updated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT event_checklists_content_check CHECK (clemora_checklist_content_valid(content)),
  CONSTRAINT event_checklists_send_fields CHECK (
    (sent_at IS NULL AND sent_by IS NULL AND coordinator_id IS NULL) OR
    (sent_at IS NOT NULL AND sent_by IS NOT NULL AND coordinator_id IS NOT NULL)
  )
);
CREATE INDEX event_checklists_coordinator_id_updated_at_idx ON event_checklists(coordinator_id, updated_at DESC);
CREATE INDEX event_checklists_created_by_idx ON event_checklists(created_by);
CREATE INDEX event_checklists_updated_by_idx ON event_checklists(updated_by);
CREATE INDEX event_checklists_sent_by_idx ON event_checklists(sent_by);
ALTER TABLE event_checklists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE event_checklists FROM PUBLIC;
REVOKE ALL ON FUNCTION clemora_checklist_content_valid(jsonb) FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.event_checklists FROM %I', client_role);
    EXECUTE format('REVOKE ALL ON FUNCTION public.clemora_checklist_content_valid(jsonb) FROM %I', client_role);
  END LOOP;
END;
$$;
COMMIT;
