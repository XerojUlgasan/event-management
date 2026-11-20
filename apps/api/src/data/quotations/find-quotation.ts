import { quoteRevision, type Database } from "./quotation-revision.js";

export const findQuoteData = (db: Database, id: string) =>
  db
    .selectFrom("quotations")
    .selectAll()
    .select(quoteRevision.as("revision"))
    .where("id", "=", id)
    .executeTakeFirst();

export const findQuoteSendAuditData = (db: Database, id: string) =>
  db
    .selectFrom("audit_events")
    .select("metadata")
    .where("entity_type", "=", "quotation")
    .where("entity_id", "=", id)
    .where("action", "=", "quotation.sent")
    .executeTakeFirst();
