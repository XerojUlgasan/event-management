import type { ResponseDeadlineDays } from "@event-management/contracts/event-days";
import { touchBookingRevisionData } from "../../data/booking-requests/booking-revision.js";
import type { Kysely } from "kysely";
import { updateEventDayStaffingData } from "../../data/event-days/update-event-day-staffing.js";
import type { DB } from "../../db/types.js";
import { deadlineForDay, fail, lockExisting, one } from "./event-days.js";
export async function staffingEventDayService(
  db: Kysely<DB>,
  id: string,
  input:
    | { staffingStatus: "open"; daysBefore: ResponseDeadlineDays }
    | { staffingStatus: "closed" },
) {
  return db.transaction().execute(async (trx) => {
    const day = await lockExisting(trx, id);
    const deadline =
      input.staffingStatus === "open"
        ? deadlineForDay(day.day, input.daysBefore, day.time_zone)
        : (day.availability_deadline?.toISOString() ?? null);
    if (
      input.staffingStatus === "open" &&
      (!deadline || new Date(deadline) <= new Date())
    )
      return fail("An open staffing deadline must be in the future", 400);
    await updateEventDayStaffingData(trx, id, input.staffingStatus, deadline);
    await touchBookingRevisionData(trx, day.booking_request_id);
    return one(trx, id);
  });
}
