import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const updateBookingStatusData = (
  db: Transaction<DB>,
  id: string,
  status: string,
) =>
  db
    .updateTable("booking_requests")
    .set({ status, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
