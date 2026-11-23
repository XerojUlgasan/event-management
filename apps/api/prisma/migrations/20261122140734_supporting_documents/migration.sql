BEGIN;

SELECT pg_catalog.set_config('search_path', pg_catalog.format('pg_catalog, public, %I', n.nspname), true)
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'vector';

-- CreateTable
CREATE TABLE public."supporting_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "original_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pipeline_version" TEXT NOT NULL,
    "extraction_status" TEXT NOT NULL DEFAULT 'pending',
    "page_count" INTEGER,
    "unreadable_pages" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "extraction_error_code" TEXT,

    CONSTRAINT "supporting_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supporting_documents_pdf_check" CHECK (mime_type = 'application/pdf' AND byte_size > 0),
    CONSTRAINT "supporting_documents_source_check" CHECK (
        btrim(original_filename) <> '' AND btrim(storage_key) <> ''
        AND file_sha256 ~ '^[0-9a-f]{64}$' AND btrim(pipeline_version) <> ''
    ),
    CONSTRAINT "supporting_documents_extraction_check" CHECK (
        extraction_status IN ('pending', 'complete', 'needs_review', 'failed')
        AND (page_count IS NULL OR page_count >= 1)
        AND (extraction_status <> 'complete' OR (page_count IS NOT NULL AND cardinality(unreadable_pages) = 0 AND extraction_error_code IS NULL))
        AND (extraction_status <> 'needs_review' OR (page_count IS NOT NULL AND cardinality(unreadable_pages) > 0))
    )
);

-- CreateTable
CREATE TABLE public."supporting_document_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "page_start" INTEGER NOT NULL,
    "page_end" INTEGER NOT NULL,
    "heading_path" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "content_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "embedding" vector(768),
    "embedding_model" TEXT,
    "embedded_at" TIMESTAMPTZ(6),

    CONSTRAINT "supporting_document_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supporting_document_chunks_source_check" CHECK (
        ordinal >= 1 AND page_start >= 1 AND page_end >= page_start
        AND btrim(content_text) <> '' AND content_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "supporting_document_chunks_embedding_check" CHECK (
        (embedding IS NULL AND embedding_model IS NULL AND embedded_at IS NULL)
        OR (embedding IS NOT NULL AND embedding_model IS NOT NULL AND btrim(embedding_model) <> '' AND embedded_at IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "supporting_documents_storage_key_key" ON public."supporting_documents"("storage_key");

-- CreateIndex
CREATE INDEX "supporting_documents_uploaded_by_idx" ON public."supporting_documents"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "supporting_document_chunks_document_id_ordinal_key" ON public."supporting_document_chunks"("document_id", "ordinal");

-- AddForeignKey
ALTER TABLE public."supporting_documents" ADD CONSTRAINT "supporting_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE public."supporting_document_chunks" ADD CONSTRAINT "supporting_document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES public."supporting_documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX supporting_documents_job_history_idx ON public.background_jobs(type, dedupe_key, created_at DESC, id DESC)
WHERE type IN ('extract_supporting_document', 'embed_document_chunk');

ALTER TABLE public.supporting_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supporting_document_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supporting_documents, public.supporting_document_chunks FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON public.supporting_documents, public.supporting_document_chunks FROM %I', client_role);
        END IF;
    END LOOP;
END $$;

COMMIT;
