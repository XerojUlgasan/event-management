import { touchBookingRevisionData } from "../../data/booking-requests/booking-revision.js";
import type { Kysely } from "kysely";
import { lockBookingRequestData } from "../../data/event-days/lock-booking-request.js";
import { createEventDayData } from "../../data/event-days/create-event-day.js";
import type { DB } from "../../db/types.js";
import { fail, one, validateSchedule, type Schedule } from "./event-days.js";

export async function createEventDayService(
  db: Kysely<DB>,
  bookingId: string,
  input: Schedule,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, bookingId);
    if (!booking) return fail("Booking request not found", 404);
    if (booking.status !== "accepted")
      return fail("Booking request must be accepted", 409);
    if (booking.requested_days !== null)
      return fail("Use a requested day's response deadline to open staffing", 409);
    const schedule = validateSchedule(input, booking.time_zone);
    await touchBookingRevisionData(trx, bookingId);
    return one(trx, await createEventDayData(trx, bookingId, schedule));
  });
}
