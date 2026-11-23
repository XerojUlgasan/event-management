import { sql } from "kysely";
import type { Database } from "./catalog-knowledge-types.js";

export async function saveCatalogKnowledgeEmbeddingData(
  db: Database,
  id: string,
  expectedHash: string,
  value: { embedding: number[]; model: string },
) {
  // pgvector may already be installed outside public, as on Supabase.
  const extension = await sql<{ schema: string }>`
    select n.nspname as schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector'
  `.execute(db);
  const schema = extension.rows[0]?.schema;

  if (!schema) throw new Error("Catalog knowledge requires pgvector");

  const result = await db
    .updateTable("catalog_knowledge")
    .set({
      embedding: sql<string>`cast(${JSON.stringify(value.embedding)} as ${sql.id(schema, "vector")})`,
      embedding_model: value.model,
      embedded_at: new Date(),
    })
    .where("id", "=", id)
    .where("content_hash", "=", expectedHash)
    .executeTakeFirst();

  return result.numUpdatedRows === 1n;
}
