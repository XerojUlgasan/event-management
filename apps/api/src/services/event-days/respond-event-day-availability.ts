import type { Kysely } from "kysely";
import { lockStaffData } from "../../data/event-days/lock-staff.js";
import { listEventDayResponsesData } from "../../data/event-days/list-event-day-responses.js";
import { upsertEventDayAvailabilityData } from "../../data/event-days/upsert-event-day-availability.js";
import type { DB } from "../../db/types.js";
import { effectiveStatus, fail, lockExisting, one } from "./event-days.js";
export async function availabilityEventDayService(
  db: Kysely<DB>,
  id: string,
  staffId: string,
  response: "available" | "unavailable",
) {
  return db.transaction().execute(async (trx) => {
    const day = await lockExisting(trx, id);
    const staff = await lockStaffData(trx, staffId);
    if (!staff || staff.role !== "staff")
      return fail("Staff access required", 409);
    const related = await listEventDayResponsesData(trx, [id]);
    // Locks may wait past the deadline; check the window after acquiring them.
    if (effectiveStatus(day) !== "open")
      return fail("Availability responses are closed", 409);
    if (
      response === "available" &&
      related.assignments.some(
        (x) => x.staff_id === staffId && x.status === "confirmed",
      )
    )
      return fail("Staff is already assigned to this event day", 409);
    await upsertEventDayAvailabilityData(trx, id, staffId, response);
    return one(trx, id, staffId);
  });
}
