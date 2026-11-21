BEGIN;

CREATE TABLE public.business_information (
  id INTEGER NOT NULL,
  information JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT business_information_pkey PRIMARY KEY (id),
  CONSTRAINT business_information_singleton_check CHECK (id = 1)
);

INSERT INTO public.business_information (id) VALUES (1);

ALTER TABLE public.business_information ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.business_information FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.business_information FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;

COMMIT;