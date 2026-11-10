import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

// Call after locking the parent booking; keep child locks in a stable order.
export function lockScheduledEventDaysData(
  db: Transaction<DB>,
  bookingId: string,
) {
  return db
    .selectFrom("events_day")
    .select("id")
    .where("booking_request_id", "=", bookingId)
    .where("status", "=", "scheduled")
    .orderBy("id")
    .forUpdate()
    .execute();
}
