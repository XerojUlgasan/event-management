import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

// Call only under the existing booking -> event-day locks, inside the staffing transaction.
export function invalidateEventChecklistData(
  db: Transaction<DB>,
  eventDayId: string,
  actorId: string,
) {
  return db
    .updateTable("event_checklists")
    .set({
      coordinator_id: null,
      sent_by: null,
      sent_at: null,
      revision: sql`revision + 1`,
      updated_by: actorId,
      updated_at: sql`clock_timestamp()`,
    })
    .where("event_day_id", "=", eventDayId)
    .where("sent_at", "is not", null)
    .execute();
}
