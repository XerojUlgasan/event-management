import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export async function markNotificationReadData(
  db: Kysely<DB>,
  userId: string,
  id: string,
) {
  const updated = await db
    .updateTable("notifications")
    .set({ read_at: sql<Date>`now()` })
    .where("recipient_user_id", "=", userId)
    .where("id", "=", id)
    .where("read_at", "is", null)
    .returning("id")
    .executeTakeFirst();

  return (
    updated ??
    db
      .selectFrom("notifications")
      .select("id")
      .where("recipient_user_id", "=", userId)
      .where("id", "=", id)
      .executeTakeFirst()
  );
}
