import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function loadDocumentChunkForEmbeddingData(
  db: Kysely<DB>,
  chunkId: string,
) {
  return db
    .selectFrom("supporting_document_chunks as c")
    .innerJoin("supporting_documents as d", "d.id", "c.document_id")
    .select(["c.content_text", "c.content_hash", "d.pipeline_version"])
    .where("c.id", "=", chunkId)
    .where("c.embedding", "is", null)
    .where("d.extraction_status", "=", "complete")
    .executeTakeFirst();
}
