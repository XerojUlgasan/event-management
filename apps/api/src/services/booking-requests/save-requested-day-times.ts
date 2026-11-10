import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { requestedDaysSchema, type SaveRequestedDayTimesInput } from "../../controllers/booking-requests/schemas.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { updateRequestedDaysData } from "../../data/booking-requests/update-requested-days.js";
import { bookingRequestDtos } from "./booking-request-response.js";
import { error } from "./booking-request-rules.js";
import { requestedDayTimesError, withSavedTimes } from "./requested-day-times.js";

export async function saveRequestedDayTimesService(db: Kysely<DB>, id: string, date: string, customerId: string, input: SaveRequestedDayTimesInput) {
  return db.transaction().execute(async trx => {
    const row = await lockBookingRequestData(trx, id);
    if (!row || row.customer_id !== customerId) return error("Booking request not found", 404);
    if (!["under_review", "needs_details", "accepted"].includes(row.status)) return error("This request is read-only", 409);
    if (row.revision !== input.expectedUpdatedAt) return error("Booking request changed. Refresh and try again", 409);
    if (row.requested_days === null) return error("Legacy requests do not have editable requested days", 409);
    const days = requestedDaysSchema.parse(row.requested_days);
    const day = days.find(day => day.date === date);
    if (!day) return error("Requested day not found", 404);
    if (day.eventDayId) return error("This day already has an operational schedule", 409);
    const invalid = requestedDayTimesError(date, input.startsAt, input.endsAt, row.time_zone);
    if (invalid) return error(invalid, 400);
    const updated = await updateRequestedDaysData(trx, id, days.map(current => current.date === date ? withSavedTimes(current, input.startsAt, input.endsAt) : current));
    return (await bookingRequestDtos(trx, [updated]))[0]!;
  });
}
