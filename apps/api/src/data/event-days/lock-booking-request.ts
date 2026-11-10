import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function lockBookingRequestData(db: Transaction<DB>, id: string) {
  return db
    .selectFrom("booking_requests")
    .select(["id", "status", "time_zone"])
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
}
