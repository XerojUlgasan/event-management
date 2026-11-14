import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export async function listBookingRequestDailyCountsData(
  db: Database,
  month: string,
  status?: string,
) {
  // DISTINCT keeps each request count once per date, including historical malformed duplicates.
  const result = await sql<{ preferred_date: string; count: string }>`
    SELECT dates.preferred_date, count(DISTINCT br.id)::text AS count
    FROM booking_requests br
    CROSS JOIN LATERAL (
      SELECT br.preferred_date WHERE br.requested_days IS NULL
      UNION
      SELECT day->>'date' FROM jsonb_array_elements(br.requested_days) AS requested(day)
    ) AS dates(preferred_date)
    WHERE dates.preferred_date LIKE ${month + "-%"}
      ${status ? sql`AND br.status = ${status}` : sql``}
    GROUP BY dates.preferred_date ORDER BY dates.preferred_date ASC
  `.execute(db);
  return result.rows;
}
