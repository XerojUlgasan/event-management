import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function findEventDayBookingData(db: Transaction<DB>, id: string) {
  return db
    .selectFrom("events_day")
    .select("booking_request_id")
    .where("id", "=", id)
    .executeTakeFirst();
}
