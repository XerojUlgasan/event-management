import { sql } from "kysely";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function upsertEventDayAvailabilityData(
  db: Transaction<DB>,
  id: string,
  staffId: string,
  response: string,
) {
  await sql`insert into event_staff_availability(event_day_id,staff_id,response) values (${id}::uuid,${staffId}::uuid,${response}) on conflict(event_day_id,staff_id) do update set response=excluded.response,responded_at=now(),updated_at=now()`.execute(
    db,
  );
}
