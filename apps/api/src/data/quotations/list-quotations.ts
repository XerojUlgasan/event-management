import { sql } from "kysely";
import { quoteRevision, type Database } from "./quotation-revision.js";

export function listQuotesPageData(
  db: Database,
  bookingId: string,
  input: {
    customer: boolean;
    quotationId?: string;
    beforeVersion?: number;
    limit: number;
  },
) {
  let query = db
    .selectFrom("quotations")
    .selectAll()
    .select(quoteRevision.as("revision"))
    .where("booking_request_id", "=", bookingId);

  if (input.customer)
    query = query
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

export function currentQuoteData(
  db: Database,
  bookingId: string,
  statuses: string[],
  customer: boolean,
  quotationId?: string,
) {
  let query = db
    .selectFrom("quotations")
    .selectAll()
    .select(quoteRevision.as("revision"))
    .where("booking_request_id", "=", bookingId)
    .where("status", "in", statuses);

  if (customer) query = query.where("sent_at", "is not", null);

  if (quotationId) query = query.where("id", "=", quotationId);

  return query.orderBy("version", "desc").limit(1).executeTakeFirst();
}

export async function quotationWriteStateData(
  db: Database,
  bookingId: string,
  excludeId?: string,
) {
  const result = await db
    .selectFrom("quotations")
    .select([
      sql<number>`coalesce(max(version), 0)::int`.as("max_version"),
      sql<boolean>`coalesce(bool_or(status in ('draft', 'sent', 'accepted')), false)`.as(
        "has_active",
      ),
      sql<boolean>`coalesce(bool_or(status = 'draft' and id <> ${excludeId ?? null}::uuid), false)`.as(
        "has_other_draft",
      ),
    ])
    .where("booking_request_id", "=", bookingId)
    .executeTakeFirstOrThrow();

  return result;
}
