import type { Transaction } from "kysely";
import { bookingRevision, nextBookingRevision } from "./booking-revision.js";
import type { DB } from "../../db/types.js";

export const updateBookingStatusData = (
  db: Transaction<DB>,
  id: string,
  status: string,
) =>
  db
    .updateTable("booking_requests")
    .set({ status, updated_at: nextBookingRevision })
    .where("id", "=", id)
    .returningAll().returning(bookingRevision.as("revision"))
    .executeTakeFirstOrThrow();
