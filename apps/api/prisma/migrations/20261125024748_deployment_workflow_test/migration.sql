BEGIN;

-- Visible in the Supabase Table Editor after the deployment workflow applies it.
CREATE TABLE public."deployment_workflow_test" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_workflow_test_pkey" PRIMARY KEY ("id")
);

ALTER TABLE public.deployment_workflow_test ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.deployment_workflow_test FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON TABLE public.deployment_workflow_test FROM %I', client_role);
        END IF;
    END LOOP;
END $$;

COMMIT;
