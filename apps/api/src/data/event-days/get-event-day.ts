import type { Database } from "./types.js";
import { listEventDaysData } from "./list-event-days.js";

export async function getEventDayData(db: Database, id: string) {
  return (await listEventDaysData(db, undefined, undefined, false, id))[0];
}
