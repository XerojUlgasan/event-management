import { SUPPORTING_DOCUMENT_SEARCH_LIMIT } from "@event-management/contracts/supporting-documents";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export async function searchSupportingDocumentsData(
  db: Kysely<DB>,
  embedding: number[],
  model: string,
) {
  const extension = await sql<{ schema: string }>`
    select n.nspname as schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector'
  `.execute(db);
  const schema = extension.rows[0]?.schema;

  if (!schema) throw new Error("Supporting document search requires pgvector");

  const vector = sql`cast(${JSON.stringify(embedding)} as ${sql.id(schema, "vector")})`;
  const { rows } = await sql<{
    id: string;
    original_filename: string;
    page_start: number;
    page_end: number;
    heading_path: string[];
    content_text: string;
    similarity: number;
    created_at: Date | null;
    embedded_at: Date;
  }>`
    with ranked as (
      select c.id, c.embedding OPERATOR(${sql.id(schema)}.<=>) ${vector} as distance
      from supporting_document_chunks c
      where c.embedding is not null and c.embedding_model = ${model}
      order by distance, c.id
      limit ${SUPPORTING_DOCUMENT_SEARCH_LIMIT}
    )
    select c.id, d.original_filename, c.page_start, c.page_end, c.heading_path,
      c.content_text, 1 - ranked.distance as similarity, first_job.created_at, c.embedded_at
    from ranked
    join supporting_document_chunks c on c.id = ranked.id
    join supporting_documents d on d.id = c.document_id
    left join lateral (
      select created_at from background_jobs
      where type = 'embed_document_chunk' and dedupe_key = c.id::text
      order by created_at asc, id asc limit 1
    ) first_job on true
    where ranked.distance < 'Infinity'::double precision
    order by ranked.distance, ranked.id
  `.execute(db);

  return rows;
}
