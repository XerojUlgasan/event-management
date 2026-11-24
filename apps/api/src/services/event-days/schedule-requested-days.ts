import type { Kysely } from "kysely";
import { requestedDaysSchema } from "../../controllers/booking-requests/schemas.js";
import type { ScheduleRequestedDaysInput } from "../../controllers/event-days/schedule-requested-days.js";
import { updateRequestedDaysData } from "../../data/booking-requests/update-requested-days.js";
import { createEventDayData } from "../../data/event-days/create-event-day.js";
import { listEventDaysData } from "../../data/event-days/list-event-days.js";
import { lockBookingRequestData } from "../../data/event-days/lock-booking-request.js";
import type { DB } from "../../db/types.js";
import { fail, responses, validateSchedule } from "./event-days.js";

export function scheduleRequestedDaysService(
  db: Kysely<DB>,
  input: ScheduleRequestedDaysInput,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, input.bookingRequestId);

    if (!booking) return fail("Booking request not found", 404);

    if (booking.status === "finished") return fail("The event is finished", 409);

    if (booking.status !== "accepted")
      return fail("Booking request must be accepted", 409);

    if (booking.revision !== input.expectedUpdatedAt)
      return fail("Booking request changed. Refresh and try again", 409);

    if (booking.requested_days === null)
      return fail("This booking uses manual event-day scheduling", 409);

    const requested = requestedDaysSchema.parse(booking.requested_days);

    const ready = requested.flatMap((day) => {
      if (day.eventDayId || !day.startsAt || !day.endsAt) return [];

      return [
        validateSchedule(
          { day: day.date, startsAt: day.startsAt, endsAt: day.endsAt },
          booking.time_zone,
        ),
      ];
    });

    const links = new Map<string, string>();

    for (const schedule of ready)
      links.set(
        schedule.day,
        await createEventDayData(trx, booking.id, schedule),
      );

    if (links.size) {
      await updateRequestedDaysData(
        trx,
        booking.id,
        requested.map((day) => {
          const eventDayId = links.get(day.date);

          return eventDayId ? { ...day, eventDayId } : day;
        }),
      );
    }

    return responses(trx, await listEventDaysData(trx, booking.id));
  });
}
