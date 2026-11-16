BEGIN;

-- The PostgreSQL server must have pgvector installed. Reuse an existing
-- extension in its current schema (for example, Supabase's extensions schema).
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
SELECT pg_catalog.set_config(
  'search_path',
  pg_catalog.format('pg_catalog, public, %I', n.nspname),
  true
)
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'vector';

CREATE TABLE public.catalog_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  package_id UUID,
  service_id UUID,
  chunk_key TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  media_id UUID,
  content_hash TEXT NOT NULL,
  embedding vector(768),
  embedding_model TEXT,
  embedded_at TIMESTAMPTZ(6),

  CONSTRAINT catalog_knowledge_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_knowledge_owner_check CHECK (
    (package_id IS NOT NULL AND service_id IS NULL)
    OR (package_id IS NULL AND service_id IS NOT NULL)
  ),
  CONSTRAINT catalog_knowledge_chunk_key_check CHECK (btrim(chunk_key) <> ''),
  CONSTRAINT catalog_knowledge_content_hash_check CHECK (btrim(content_hash) <> ''),
  CONSTRAINT catalog_knowledge_embedding_state_check CHECK (
    (embedding IS NULL AND embedding_model IS NULL AND embedded_at IS NULL)
    OR (embedding IS NOT NULL AND embedding_model IS NOT NULL
      AND btrim(embedding_model) <> '' AND embedded_at IS NOT NULL)
  ),
  CONSTRAINT catalog_knowledge_package_id_fkey FOREIGN KEY (package_id)
    REFERENCES public.packages(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT catalog_knowledge_service_id_fkey FOREIGN KEY (service_id)
    REFERENCES public.services(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT catalog_knowledge_media_id_fkey FOREIGN KEY (media_id)
    REFERENCES public.media_assets(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- These unique indexes also cover the owner foreign keys.
CREATE UNIQUE INDEX catalog_knowledge_package_id_chunk_key_key
  ON public.catalog_knowledge(package_id, chunk_key);
CREATE UNIQUE INDEX catalog_knowledge_service_id_chunk_key_key
  ON public.catalog_knowledge(service_id, chunk_key);
CREATE INDEX catalog_knowledge_media_id_idx ON public.catalog_knowledge(media_id);

ALTER TABLE public.catalog_knowledge ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.catalog_knowledge FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.catalog_knowledge FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
