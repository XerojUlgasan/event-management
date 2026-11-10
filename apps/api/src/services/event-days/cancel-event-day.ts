import type { Kysely } from "kysely";
import * as data from "../../data/event-days/event-days.js";
import type { DB } from "../../db/types.js";
import { lockExisting, one } from "./event-days.js";
export async function cancelEventDayService(db: Kysely<DB>, id: string) {
  return db.transaction().execute(async (trx) => {
    await lockExisting(trx, id, false);
    await data.endDayData(trx, id, "cancelled", null);
    return one(trx, id);
  });
}
