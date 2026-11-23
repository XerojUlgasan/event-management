import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function getSupportingDocumentStorageKeyData(
  db: Kysely<DB>,
  id: string,
) {
  return db
    .selectFrom("supporting_documents")
    .select("storage_key")
    .where("id", "=", id)
    .executeTakeFirst();
}

export function deleteSupportingDocumentData(db: Kysely<DB>, id: string) {
  return db.deleteFrom("supporting_documents").where("id", "=", id).execute();
}
