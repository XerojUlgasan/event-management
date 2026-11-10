import type { Kysely } from "kysely";
import * as data from "../../data/event-days/event-days.js";
import type { DB } from "../../db/types.js";
import { effectiveStatus, fail, lockExisting, one } from "./event-days.js";
export async function assignmentEventDayService(
  db: Kysely<DB>,
  id: string,
  staffId: string,
  actorId: string,
  input: { role: "coordinator" | "helper"; status: "confirmed" | "cancelled" },
) {
  return db.transaction().execute(async (trx) => {
    const day = await lockExisting(trx, id, input.status === "confirmed");
    if (input.status === "confirmed" && effectiveStatus(day) !== "closed")
      return fail("Close availability responses before assigning staff", 409);
    const staff = await data.lockStaffData(trx, staffId);
    if (!staff || (input.status === "confirmed" && staff.role !== "staff"))
      return fail("Staff member is not eligible", 409);
    const related = await data.relatedData(trx, [id]);
    const existing = related.assignments.find((x) => x.staff_id === staffId);
    if (input.status === "cancelled" && !existing)
      return fail("Assignment not found", 404);
    if (input.status === "confirmed") {
      if (
        !related.availability.some(
          (x) => x.staff_id === staffId && x.response === "available",
        )
      )
        return fail("Staff member has not responded available", 409);
      if (
        input.role === "coordinator" &&
        related.assignments.some(
          (x) =>
            x.staff_id !== staffId &&
            x.role === "coordinator" &&
            x.status === "confirmed",
        )
      )
        return fail("A coordinator is already assigned", 409);
      if (await data.overlapData(trx, day, staffId))
        return fail("Staff member has an overlapping assignment", 409);
    }
    await data.upsertAssignmentData(
      trx,
      id,
      staffId,
      actorId,
      input.role,
      input.status,
    );
    return one(trx, id);
  });
}
