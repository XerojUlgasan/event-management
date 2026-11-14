import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function getEventChecklistData(db: Transaction<DB>, eventDayId: string) {
  return db
    .selectFrom("event_checklists")
    .selectAll()
    .where("event_day_id", "=", eventDayId)
    .forUpdate()
    .executeTakeFirst();
}
