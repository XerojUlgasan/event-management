import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

// Fetch once for the whole booking page, including moved/cancelled history.
export function listRequestedDaySchedulesData(db: Kysely<DB> | Transaction<DB>, bookingIds: string[]) {
  if (!bookingIds.length) return Promise.resolve([]);
  return db.selectFrom("events_day")
    .select(["id", "booking_request_id", "starts_at", "ends_at", "status", "replacement_event_day_id", sql<string>`day::text`.as("day")])
    .where("booking_request_id", "in", bookingIds).execute();
}
