import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export type SupportingDocumentProgressRow = {
  id: string;
  original_filename: string;
  byte_size: number;
  created_at: Date;
  page_count: number | null;
  unreadable_pages: number[];
  extraction_status: string;
  extraction_error_code: string | null;
  extraction_job_status: string | null;
  chunk_count: number;
  embedded_count: number;
  failed_count: number;
};

export async function listSupportingDocumentsData(
  db: Kysely<DB>,
  documentId?: string,
): Promise<SupportingDocumentProgressRow[]> {
  const { rows } = await sql<SupportingDocumentProgressRow>`
    SELECT d.id, d.original_filename, d.byte_size, d.created_at, d.page_count,
      d.unreadable_pages, d.extraction_status, d.extraction_error_code, extraction_job.status AS extraction_job_status,
      chunks.chunk_count, chunks.embedded_count, chunks.failed_count
    FROM supporting_documents d
    LEFT JOIN LATERAL (
      SELECT j.status FROM background_jobs j
      WHERE j.type = 'extract_supporting_document' AND j.dedupe_key = d.id::text
      ORDER BY j.created_at DESC, j.id DESC LIMIT 1
    ) extraction_job ON true
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS chunk_count, count(c.embedding)::integer AS embedded_count,
        count(*) FILTER (WHERE c.embedding IS NULL AND chunk_job.status = 'failed')::integer AS failed_count
      FROM supporting_document_chunks c
      LEFT JOIN LATERAL (
        SELECT j.status FROM background_jobs j
        WHERE j.type = 'embed_document_chunk' AND j.dedupe_key = c.id::text AND c.embedding IS NULL
        ORDER BY j.created_at DESC, j.id DESC LIMIT 1
      ) chunk_job ON true
      WHERE c.document_id = d.id
    ) chunks
    ${documentId ? sql`WHERE d.id = ${documentId}::uuid` : sql``}
    ORDER BY d.created_at DESC, d.id DESC
  `.execute(db);

  return rows;
}
