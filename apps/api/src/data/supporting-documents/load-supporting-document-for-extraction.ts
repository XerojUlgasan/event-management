import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function loadSupportingDocumentForExtractionData(
  db: Kysely<DB>,
  id: string,
) {
  return db
    .selectFrom("supporting_documents")
    .select(["pipeline_version", "storage_key", "file_sha256"])
    .where("id", "=", id)
    .where("extraction_status", "=", "pending")
    .executeTakeFirst();
}
