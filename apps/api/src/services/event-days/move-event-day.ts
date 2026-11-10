import type { Kysely } from "kysely";
import * as data from "../../data/event-days/event-days.js";
import type { DB } from "../../db/types.js";
import {
  lockExisting,
  one,
  validateSchedule,
  type Schedule,
} from "./event-days.js";
export async function moveEventDayService(
  db: Kysely<DB>,
  id: string,
  input: Schedule,
) {
  return db.transaction().execute(async (trx) => {
    const day = await lockExisting(trx, id);
    validateSchedule(input, day.time_zone);
    const replacement = await data.createDayData(
      trx,
      day.booking_request_id,
      input,
    );
    await data.endDayData(trx, id, "moved", replacement);
    return one(trx, replacement);
  });
}
