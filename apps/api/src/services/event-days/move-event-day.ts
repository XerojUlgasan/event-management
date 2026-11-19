import { touchBookingRevisionData } from "../../data/booking-requests/booking-revision.js";
import type { Kysely } from "kysely";
import { createEventDayData } from "../../data/event-days/create-event-day.js";
import { endEventDayData } from "../../data/event-days/end-event-day.js";
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
    const schedule = validateSchedule(input, day.time_zone);
    const replacement = await createEventDayData(
      trx,
      day.booking_request_id,
      schedule,
    );
    await endEventDayData(trx, id, "moved", replacement);
    await touchBookingRevisionData(trx, day.booking_request_id);

    return one(trx, replacement);
  });
}
