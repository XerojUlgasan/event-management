BEGIN;

CREATE TABLE public.background_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ(6),
  last_error TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ(6),

  CONSTRAINT background_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT background_jobs_type_check CHECK (btrim(type) <> ''),
  CONSTRAINT background_jobs_payload_check CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT background_jobs_dedupe_key_check CHECK (
    dedupe_key IS NULL OR btrim(dedupe_key) <> ''
  ),
  CONSTRAINT background_jobs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  ),
  CONSTRAINT background_jobs_attempts_check CHECK (attempts >= 0),
  CONSTRAINT background_jobs_lease_check CHECK (
    (status = 'running' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'running' AND lease_token IS NULL AND lease_expires_at IS NULL)
  ),
  CONSTRAINT background_jobs_completion_check CHECK (
    (status IN ('pending', 'running') AND completed_at IS NULL)
    OR (status IN ('completed', 'failed') AND completed_at IS NOT NULL)
  ),
  CONSTRAINT background_jobs_completed_at_check CHECK (
    completed_at IS NULL OR completed_at >= created_at
  )
);

CREATE INDEX background_jobs_status_available_at_idx
  ON public.background_jobs(status, available_at);
CREATE INDEX background_jobs_status_lease_expires_at_idx
  ON public.background_jobs(status, lease_expires_at);

-- Keep one pending job per type/key, allowing a follow-up while an older job runs.
CREATE UNIQUE INDEX background_jobs_pending_type_dedupe_key_key
  ON public.background_jobs(type, dedupe_key)
  WHERE status = 'pending' AND dedupe_key IS NOT NULL;

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.background_jobs FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.background_jobs FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
