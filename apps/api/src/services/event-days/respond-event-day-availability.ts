import type { Kysely } from "kysely";
import * as data from "../../data/event-days/event-days.js";
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
    const staff = await data.lockStaffData(trx, staffId);
    if (!staff || staff.role !== "staff")
      return fail("Staff access required", 409);
    const related = await data.relatedData(trx, [id]);
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
    await data.upsertAvailabilityData(trx, id, staffId, response);
    return one(trx, id, staffId);
  });
}
