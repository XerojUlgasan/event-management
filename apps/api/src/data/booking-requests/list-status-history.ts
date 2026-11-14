import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export function listStatusHistoryData(
  db: Database,
  bookingId: string,
  input: { limit: number; position?: { createdAt: string; id: string } },
) {
  let query = db
    .selectFrom("booking_request_status_history")
    .selectAll()
    .select(
      sql<string>`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
        "cursor_created_at",
      ),
    )
    .where("booking_request_id", "=", bookingId);
  if (input.position)
    query = query.where(
      sql<boolean>`(created_at, id) > (${input.position.createdAt}::timestamptz, ${input.position.id}::uuid)`,
    );
  return query
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .limit(input.limit + 1)
    .execute();
}
