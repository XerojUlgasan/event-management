import type { Kysely } from "kysely";
import { endEventDayData } from "../../data/event-days/end-event-day.js";
import type { DB } from "../../db/types.js";
import { lockExisting, one } from "./event-days.js";
export async function cancelEventDayService(db: Kysely<DB>, id: string) {
  return db.transaction().execute(async (trx) => {
    await lockExisting(trx, id, false);
    await endEventDayData(trx, id, "cancelled", null);
    return one(trx, id);
  });
}
