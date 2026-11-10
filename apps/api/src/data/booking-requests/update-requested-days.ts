import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { RequestedDay } from "../../controllers/booking-requests/schemas.js";
import { bookingRevision, nextBookingRevision } from "./booking-revision.js";

export const updateRequestedDaysData = (db: Transaction<DB>, id: string, days: RequestedDay[]) =>
  db.updateTable("booking_requests")
    .set({ requested_days: JSON.stringify(days), updated_at: nextBookingRevision })
    .where("id", "=", id).returningAll().returning(bookingRevision.as("revision")).executeTakeFirstOrThrow();
