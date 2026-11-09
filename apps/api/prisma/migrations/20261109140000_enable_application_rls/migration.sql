-- Browser clients use Clemora's session-aware API, not direct table access.
-- Leave FORCE RLS off so the owning API/migration role retains access.
-- No client policies are needed until direct Data API access is supported.
DO $$
DECLARE
  target_table text;
  client_role text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'sessions',
    'packages',
    'services',
    'venues',
    'conversations',
    'messages',
    'booking_requests',
    'booking_request_status_history',
    'catalog_pages',
    'catalog_sections',
    'catalog_widgets',
    'media_assets',
    '_prisma_migrations'
  ] LOOP
    -- SQL-replay test databases do not have Prisma's bookkeeping table.
    IF target_table = '_prisma_migrations'
      AND to_regclass('public._prisma_migrations') IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    -- RLS does not govern TRUNCATE, so remove unused table grants as well.
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', target_table);
    FOR client_role IN
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', target_table, client_role);
    END LOOP;
  END LOOP;
END;
$$;
