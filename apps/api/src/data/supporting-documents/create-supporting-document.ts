import type { Insertable, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function createSupportingDocumentData(
  trx: Transaction<DB>,
  document: Insertable<DB["supporting_documents"]>,
) {
  return trx.insertInto("supporting_documents").values(document).execute();
}
