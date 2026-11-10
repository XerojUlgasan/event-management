import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const lockBookingRequestData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("booking_requests")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
