import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const listCustomPackageHistoryData = (db: Database, bookingId: string, input: { limit: number; position?: { createdAt: string; id: string } }) => {
  let query = db.selectFrom("audit_events").select(["id", "actor_id", "action", "metadata", "created_at"])
    .select(sql<string>`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as("cursor_created_at"))
    .where("entity_type", "=", "booking_request").where("entity_id", "=", bookingId)
    .where("action", "in", ["booking.custom_package_created", "booking.custom_package_updated"]);
  if (input.position) query = query.where(sql<boolean>`(created_at, id) < (${input.position.createdAt}::timestamptz, ${input.position.id}::uuid)`);
  return query.orderBy("created_at", "desc").orderBy("id", "desc").limit(input.limit + 1).execute();
};
