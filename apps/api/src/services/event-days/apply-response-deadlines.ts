import type { Kysely } from "kysely";
import { requestedDaysSchema } from "../../controllers/booking-requests/schemas.js";
import type { ApplyResponseDeadlinesInput } from "../../controllers/event-days/apply-response-deadlines.js";
import { touchBookingRevisionData } from "../../data/booking-requests/booking-revision.js";
import { updateRequestedDaysData } from "../../data/booking-requests/update-requested-days.js";
import { createEventDayData } from "../../data/event-days/create-event-day.js";
import { listEventDaysData } from "../../data/event-days/list-event-days.js";
import { lockBookingRequestData } from "../../data/event-days/lock-booking-request.js";
import { lockEventDayData } from "../../data/event-days/lock-event-day.js";
import { updateEventDayStaffingData } from "../../data/event-days/update-event-day-staffing.js";
import type { DB } from "../../db/types.js";
import { deadlineForDay, effectiveStatus, fail, responses, validateSchedule } from "./event-days.js";

export async function applyResponseDeadlinesService(db: Kysely<DB>, input: ApplyResponseDeadlinesInput) {
  return db.transaction().execute(async trx => {
    const booking = await lockBookingRequestData(trx, input.bookingRequestId);
    if (!booking) return fail("Booking request not found", 404);
    if (booking.status !== "accepted") return fail("Booking request must be accepted", 409);
    if (booking.revision !== input.expectedUpdatedAt) return fail("Booking request changed. Refresh and try again", 409);
    const requested = booking.requested_days === null ? null : requestedDaysSchema.parse(booking.requested_days);
    const ready = requested?.filter(day => !day.eventDayId && day.startsAt && day.endsAt) ?? [];
    const existing = (await listEventDaysData(trx, booking.id)).filter(day => day.status === "scheduled");
    if (!ready.length && !existing.length) return fail("No event days with saved times are ready for deadlines", 409);
    const updates = [];
    for (const existingDay of existing) {
      const day = await lockEventDayData(trx, existingDay.id);
      if (!day || day.status !== "scheduled") return fail("Event day changed. Refresh and try again", 409);
      const status = effectiveStatus(day);
      const deadline = deadlineForDay(day.day, input.daysBefore, booking.time_zone);
      if (status === "open" && new Date(deadline) <= new Date()) return fail(`The response deadline for ${day.day} must be in the future`, 400);
      updates.push({ id: day.id, status, deadline });
    }
    const creations = ready.map(day => {
      if (!day.startsAt || !day.endsAt) return fail("Customer times are required before opening staffing", 409);
      const schedule = validateSchedule({ day: day.date, startsAt: day.startsAt, endsAt: day.endsAt, staffingStatus: "open", daysBefore: input.daysBefore }, booking.time_zone);
      return { date: day.date, schedule };
    });
    for (const update of updates) await updateEventDayStaffingData(trx, update.id, update.status, update.deadline);
    const links = new Map<string, string>();
    for (const creation of creations) links.set(creation.date, await createEventDayData(trx, booking.id, creation.schedule));
    if (requested && links.size) {
      await updateRequestedDaysData(trx, booking.id, requested.map(day => {
        const id = links.get(day.date);
        return id ? { ...day, eventDayId: id } : day;
      }));
    } else await touchBookingRevisionData(trx, booking.id);
    return responses(trx, await listEventDaysData(trx, booking.id));
  });
}
