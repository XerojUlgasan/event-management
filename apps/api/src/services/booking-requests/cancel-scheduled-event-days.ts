import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { endEventDayData } from "../../data/event-days/end-event-day.js";
import { lockScheduledEventDaysData } from "../../data/event-days/lock-scheduled-event-days.js";

export async function cancelScheduledEventDaysService(
  trx: Transaction<DB>,
  bookingId: string,
  actorId: string,
) {
  const days = await lockScheduledEventDaysData(trx, bookingId);
  for (const day of days) await endEventDayData(trx, day.id, "cancelled", null, actorId);
}
