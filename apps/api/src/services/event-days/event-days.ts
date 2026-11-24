import { calendarDateInTimeZone } from "@event-management/contracts/calendar-date";
import type { Transaction } from "kysely";
import type { DayRow } from "../../data/event-days/types.js";
import type { Database } from "../../data/event-days/types.js";
import { getEventDayData } from "../../data/event-days/get-event-day.js";
import { findEventDayBookingData } from "../../data/event-days/find-event-day-booking.js";
import { lockBookingRequestData } from "../../data/event-days/lock-booking-request.js";
import { lockEventDayData } from "../../data/event-days/lock-event-day.js";
import type { DB } from "../../db/types.js";

export type Schedule = {
  day: string;
  startsAt: string;
  endsAt: string;
};

export class EventDayError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export const fail = (message: string, status: 400 | 404 | 409): never => {
  throw new EventDayError(message, status);
};

export function validateSchedule(input: Schedule, timeZone: string) {
  const start = new Date(input.startsAt),
    end = new Date(input.endsAt);

  if (calendarDateInTimeZone(start, timeZone) !== input.day)
    fail("Day must match the start date in the booking time zone", 400);

  if (end <= start) fail("End must be after start", 400);

  return input;
}

export function responses(db: Database, days: DayRow[]) {
  return days.map((day) => ({
    id: day.id,
    bookingRequestId: day.booking_request_id,
    bookingReference: day.booking_reference,
    packageName: day.package_name,
    eventType: day.event_type,
    timezone: day.time_zone,
    day: day.day,
    startsAt: day.starts_at.toISOString(),
    endsAt: day.ends_at.toISOString(),
    status: day.status,
    replacementEventDayId: day.replacement_event_day_id,
  }));
}

export async function one(db: Database, id: string) {
  const day = await getEventDayData(db, id);

  if (!day) return fail("Event day not found", 404);

  const result = responses(db, [day])[0];

  if (!result) throw new Error("Event day response missing");

  return result;
}

export async function lockExisting(
  trx: Transaction<DB>,
  id: string,
  requireAccepted = true,
) {
  const ref = await findEventDayBookingData(trx, id);

  if (!ref) return fail("Event day not found", 404);

  const booking = await lockBookingRequestData(trx, ref.booking_request_id);

  if (!booking || (requireAccepted && booking.status !== "accepted"))
    return fail("Booking request must be accepted", 409);

  if (booking.event_finished_at) return fail("The event is finished", 409);

  const day = await lockEventDayData(trx, id);

  if (!day) return fail("Event day not found", 404);

  if (day.status !== "scheduled")
    return fail("Event day is no longer scheduled", 409);

  return day;
}
