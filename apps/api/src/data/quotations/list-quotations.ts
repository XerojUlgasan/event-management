import { sql } from "kysely";
import { quoteRevision, type Database } from "./quotation-revision.js";

export function listQuotesPageData(
  db: Database,
  bookingId: string,
  input: {
    quotationId?: string;
    beforeVersion?: number;
    limit: number;
  },
) {
  let query = db
    .selectFrom("quotations")
    .selectAll()
    .select(quoteRevision.as("revision"))
    .where("booking_request_id", "=", bookingId)
    .where("status", "!=", "draft")
    .where("sent_at", "is not", null);

  if (input.quotationId) query = query.where("id", "=", input.quotationId);

  if (input.beforeVersion !== undefined)
    query = query.where("version", "<", input.beforeVersion);

  return query
    .orderBy("version", "desc")
    .limit(input.limit + 1)
    .execute();
}

// Legacy preparation could supersede an offer before a replacement was
// delivered. Use the last delivered version when no sent offer exists.
export function latestDeliveredQuoteData(db: Database, bookingId: string) {
  return db
    .selectFrom("quotations")
    .selectAll()
    .select(quoteRevision.as("revision"))
    .where("booking_request_id", "=", bookingId)
    .where("status", "!=", "draft")
    .where("sent_at", "is not", null)
    .orderBy(sql<boolean>`status = 'sent'`, "desc")
    .orderBy("version", "desc")
    .limit(1)
    .executeTakeFirst();
}

export async function latestQuoteVersionData(db: Database, bookingId: string) {
  const result = await db
    .selectFrom("quotations")
    .select(sql<number>`coalesce(max(version), 0)::int`.as("version"))
    .where("booking_request_id", "=", bookingId)
    .executeTakeFirstOrThrow();

  return result.version;
}
