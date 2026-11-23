import type { Insertable, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function createDocumentChunksData(
  trx: Transaction<DB>,
  chunks: Insertable<DB["supporting_document_chunks"]>[],
) {
  return trx
    .insertInto("supporting_document_chunks")
    .values(chunks)
    .returning("id")
    .execute();
}
