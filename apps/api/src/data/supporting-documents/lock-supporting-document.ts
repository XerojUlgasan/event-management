import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function lockSupportingDocumentData(
  trx: Transaction<DB>,
  id: string,
  { extractionStatus }: { extractionStatus?: "pending" } = {},
) {
  const query = trx
    .selectFrom("supporting_documents")
    .select("extraction_status")
    .where("id", "=", id);

  return (
    extractionStatus
      ? query.where("extraction_status", "=", extractionStatus)
      : query
  )
    .forUpdate()
    .executeTakeFirst();
}
