import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function listFailedDocumentChunksData(
  trx: Transaction<DB>,
  documentId: string,
) {
  const { rows } = await sql<{ id: string }>`
    SELECT c.id FROM supporting_document_chunks c
    WHERE c.document_id = ${documentId}::uuid AND c.embedding IS NULL
      AND (SELECT j.status FROM background_jobs j
        WHERE j.type = 'embed_document_chunk' AND j.dedupe_key = c.id::text
        ORDER BY j.created_at DESC, j.id DESC LIMIT 1) = 'failed'
    ORDER BY c.ordinal
  `.execute(trx);

  return rows;
}
