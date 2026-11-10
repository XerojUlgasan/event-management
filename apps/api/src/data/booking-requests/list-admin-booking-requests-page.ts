import { bookingRevision } from "./booking-revision.js";
import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const listAdminBookingRequestsPageData = (
  db: Database,
  input: {
    status?: string;
    preferredDate?: string;
    cursor?: string;
    limit: number;
  },
) => {
  let query = db.selectFrom("booking_requests").selectAll().select(bookingRevision.as("revision"));
  if (input.status) query = query.where("status", "=", input.status);
  if (input.preferredDate)
    query = query.where(sql<boolean>`(
      (requested_days IS NULL AND preferred_date = ${input.preferredDate}) OR
      EXISTS (SELECT 1 FROM jsonb_array_elements(requested_days) AS requested(day) WHERE day->>'date' = ${input.preferredDate})
    )`);
  if (input.cursor)
    query = query.where(
      sql<boolean>`(created_at, id) < (select created_at, id from booking_requests where id = ${input.cursor}::uuid)`,
    );
  return query
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(input.limit + 1)
    .execute();
};
