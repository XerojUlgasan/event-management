import { quoteRevision, type Database } from "./quotation-revision.js";

export const listQuotesData = (db: Database, bookingId: string) =>
  db
    .selectFrom("quotations")
    .selectAll()
    .select(quoteRevision.as("revision"))
    .where("booking_request_id", "=", bookingId)
    .orderBy("version", "desc")
    .execute();
