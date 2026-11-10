import type { Kysely } from "kysely";
import { listEventDaysData } from "../../data/event-days/list-event-days.js";
import type { DB } from "../../db/types.js";
import { responses } from "./event-days.js";
export async function listEventDaysService(
  db: Kysely<DB>,
  bookingId?: string,
  staffId?: string,
  assignmentsOnly = false,
) {
  return responses(
    db,
    await listEventDaysData(db, bookingId, staffId, assignmentsOnly),
    staffId,
  );
}
