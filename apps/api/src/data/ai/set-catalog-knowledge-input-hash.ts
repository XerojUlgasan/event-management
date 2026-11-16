import type { Database } from "./catalog-knowledge-types.js";

export async function setCatalogKnowledgeInputHashData(
  db: Database,
  id: string,
  expectedHash: string,
  inputHash: string,
) {
  const result = await db
    .updateTable("catalog_knowledge")
    .set({
      content_hash: inputHash,
      embedding: null,
      embedding_model: null,
      embedded_at: null,
    })
    .where("id", "=", id)
    .where("content_hash", "=", expectedHash)
    .executeTakeFirst();
  return result.numUpdatedRows === 1n;
}
