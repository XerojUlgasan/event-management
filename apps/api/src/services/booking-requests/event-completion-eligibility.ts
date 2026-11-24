import type { Transaction } from "kysely";
import { requestedDaysSchema } from "../../controllers/booking-requests/schemas.js";
import { liveEventDaysHaveEndedData } from "../../data/booking-requests/event-completion.js";
import { listRequestedDaySchedulesData } from "../../data/booking-requests/list-requested-day-schedules.js";
import type { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import type { DB } from "../../db/types.js";

type LockedBooking = NonNullable<
  Awaited<ReturnType<typeof lockBookingRequestData>>
>;

export async function isEventCompletionEligible(
  trx: Transaction<DB>,
  booking: LockedBooking,
) {
  if (booking.status === "declined" || booking.status === "cancelled")
    return false;

  if (booking.requested_days !== null) {
    const requested = requestedDaysSchema.safeParse(booking.requested_days);

    if (!requested.success || requested.data.some((day) => !day.eventDayId))
      return false;

    const schedules = new Map(
      (await listRequestedDaySchedulesData(trx, [booking.id])).map((day) => [
        day.id,
        day,
      ]),
    );

    const resolved = new Set<string>();

    for (const day of requested.data) {
      let schedule = schedules.get(day.eventDayId ?? "");
      const visited = new Set<string>();

      while (schedule?.status === "moved" && !visited.has(schedule.id)) {
        visited.add(schedule.id);
        schedule = schedules.get(schedule.replacement_event_day_id ?? "");
      }

      if (
        !schedule ||
        (schedule.status !== "scheduled" && schedule.status !== "cancelled") ||
        resolved.has(schedule.id)
      )
        return false;

      resolved.add(schedule.id);
    }
  }

  return liveEventDaysHaveEndedData(trx, booking.id);
}
