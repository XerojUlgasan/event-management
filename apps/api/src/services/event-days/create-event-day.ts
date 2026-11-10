import type { Kysely } from "kysely";
import * as data from "../../data/event-days/event-days.js";
import type { DB } from "../../db/types.js";
import { fail, one, validateSchedule, type Schedule } from "./event-days.js";
export async function createEventDayService(
  db: Kysely<DB>,
  bookingId: string,
  input: Schedule,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await data.lockBookingData(trx, bookingId);
    if (!booking) return fail("Booking request not found", 404);
    if (booking.status !== "accepted")
      return fail("Booking request must be accepted", 409);
    validateSchedule(input, booking.time_zone);
    return one(trx, await data.createDayData(trx, bookingId, input));
  });
}
