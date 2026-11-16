import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function searchCatalogKnowledgeData(
  db: Transaction<DB>,
  embedding: number[],
  model: string,
) {
  const extension = await sql<{ schema: string }>`
    select n.nspname as schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector'
  `.execute(db);
  const schema = extension.rows[0]?.schema;
  if (!schema) throw new Error("Catalog knowledge requires pgvector");
  const vector = sql`cast(${JSON.stringify(embedding)} as ${sql.id(schema, "vector")})`;
  // Return all eligible candidates: source freshness is assessed in the same
  // snapshot before selecting the top results, so stale rows cannot consume slots.
  return sql<{
    package_id: string | null;
    service_id: string | null;
    chunk_key: string;
    similarity: number;
  }>`
    select k.package_id, k.service_id, k.chunk_key,
      1 - (k.embedding OPERATOR(${sql.id(schema)}.<=>) ${vector}) as similarity
    from catalog_knowledge k
    left join packages p on p.id = k.package_id
    left join services s on s.id = k.service_id
    where k.embedding is not null and k.embedded_at is not null
      and k.embedding_model = ${model}
      and ((p.id is not null and p.package_type = 'catalog' and p.archived_at is null)
        or (s.id is not null and s.archived_at is null))
    order by similarity desc, k.id
  `.execute(db);
}
