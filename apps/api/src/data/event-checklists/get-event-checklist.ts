import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function getEventChecklistData(db: Transaction<DB>, eventDayId: string) {
  return db.selectFrom("event_checklists").selectAll().where("event_day_id", "=", eventDayId).forUpdate().executeTakeFirst();
}
export function getCoordinatorData(db: Transaction<DB>, eventDayId: string) {
  return db.selectFrom("event_staffs as s").innerJoin("users as u", "u.id", "s.staff_id")
    .select("s.staff_id").where("s.event_day_id", "=", eventDayId)
    .where("s.role", "=", "coordinator").where("s.status", "=", "confirmed").where("u.role", "=", "staff").executeTakeFirst();
}
