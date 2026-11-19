import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { getEventDayData } from "./get-event-day.js";

export async function lockEventDayData(db: Transaction<DB>, id: string) {
  await db
    .selectFrom("events_day")
    .select("id")
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();

  return getEventDayData(db, id);
}
