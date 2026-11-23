import type { Transaction, Updateable } from "kysely";
import type { DB } from "../../db/types.js";

type ExtractionUpdate = Pick<
  Updateable<DB["supporting_documents"]>,
  | "extraction_status"
  | "page_count"
  | "unreadable_pages"
  | "extraction_error_code"
>;

export function saveSupportingDocumentExtractionData(
  trx: Transaction<DB>,
  id: string,
  extraction: ExtractionUpdate,
) {
  return trx
    .updateTable("supporting_documents")
    .set(extraction)
    .where("id", "=", id)
    .execute();
}
