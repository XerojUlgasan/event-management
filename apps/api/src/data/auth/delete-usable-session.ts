import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function deleteUsableSessionData(
  db: Transaction<DB>,
  sessionId: string,
  userId: string,
) {
  return db
    .deleteFrom("sessions")
    .where("id", "=", sessionId)
    .where("user_id", "=", userId)
    .where("expires_at", ">", sql<Date>`clock_timestamp()`)
    .returning("id")
    .executeTakeFirst();
}
