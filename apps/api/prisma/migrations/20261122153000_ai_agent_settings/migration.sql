BEGIN;

CREATE TABLE public.ai_agent_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL DEFAULT 'AMAC AI'
    CHECK (char_length(trim(display_name)) BETWEEN 1 AND 60),
  greeting TEXT CHECK (char_length(greeting) <= 240),
  personality TEXT NOT NULL DEFAULT 'warm_concise'
    CHECK (personality IN ('professional', 'friendly', 'warm_concise')),
  additional_instructions TEXT NOT NULL DEFAULT ''
    CHECK (char_length(additional_instructions) <= 2000),
  allow_business_information BOOLEAN NOT NULL DEFAULT TRUE,
  allow_public_catalog BOOLEAN NOT NULL DEFAULT TRUE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.ai_agent_settings (id) VALUES (1);

ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.ai_agent_settings FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.ai_agent_settings FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
