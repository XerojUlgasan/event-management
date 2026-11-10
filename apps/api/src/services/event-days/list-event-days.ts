import type { Kysely } from "kysely";
import * as data from "../../data/event-days/event-days.js";
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
    await data.listDaysData(db, bookingId, staffId, assignmentsOnly),
    staffId,
  );
}
