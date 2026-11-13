import { sql, type Transaction } from "kysely";
import type { Updateable } from "kysely";
import type { DB, EventChecklists } from "../../db/types.js";

export function saveEventChecklistData(db: Transaction<DB>, id: string, expectedRevision: number, actorId: string, values: Pick<Updateable<EventChecklists>, "title" | "content" | "coordinator_id" | "sent_by" | "sent_at">) {
  return db.updateTable("event_checklists").set({ ...values, revision: sql`revision + 1`, updated_by: actorId, updated_at: sql`clock_timestamp()` })
    .where("id", "=", id).where("revision", "=", expectedRevision).returningAll().executeTakeFirst();
}
