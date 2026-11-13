import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function createEventChecklistData(db: Transaction<DB>, eventDayId: string, actorId: string, title: string) {
  return db.insertInto("event_checklists").values({ event_day_id: eventDayId, title, created_by: actorId, updated_by: actorId }).returningAll().executeTakeFirstOrThrow();
}
