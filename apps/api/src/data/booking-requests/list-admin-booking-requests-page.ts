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
  let query = db.selectFrom("booking_requests").selectAll();
  if (input.status) query = query.where("status", "=", input.status);
  if (input.preferredDate)
    query = query.where("preferred_date", "=", input.preferredDate);
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
