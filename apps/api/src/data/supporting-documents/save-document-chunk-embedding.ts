import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function saveDocumentChunkEmbeddingData(
  trx: Transaction<DB>,
  {
    chunkId,
    contentHash,
    embedding,
    model,
  }: {
    chunkId: string;
    contentHash: string;
    embedding: number[];
    model: string;
  },
) {
  return trx
    .updateTable("supporting_document_chunks")
    .set({
      embedding: sql<string>`${JSON.stringify(embedding)}`,
      embedding_model: model,
      embedded_at: new Date(),
    })
    .where("id", "=", chunkId)
    .where("embedding", "is", null)
    .where("content_hash", "=", contentHash)
    .execute();
}
