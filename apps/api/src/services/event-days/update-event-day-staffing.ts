import type { Kysely } from "kysely";
import { updateEventDayStaffingData } from "../../data/event-days/update-event-day-staffing.js";
import type { DB } from "../../db/types.js";
import { fail, lockExisting, one } from "./event-days.js";
export async function staffingEventDayService(
  db: Kysely<DB>,
  id: string,
  input: { staffingStatus: "open" | "closed"; availabilityDeadline?: string },
) {
  return db.transaction().execute(async (trx) => {
    const day = await lockExisting(trx, id);
    const deadline =
      input.availabilityDeadline ??
      day.availability_deadline?.toISOString() ??
      null;
    if (
      input.staffingStatus === "open" &&
      (!deadline || new Date(deadline) <= new Date())
    )
      return fail("An open staffing deadline must be in the future", 400);
    await updateEventDayStaffingData(trx, id, input.staffingStatus, deadline);
    return one(trx, id);
  });
}
