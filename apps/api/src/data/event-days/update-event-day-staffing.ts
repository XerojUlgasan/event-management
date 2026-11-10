import { sql } from "kysely";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function updateEventDayStaffingData(
  db: Transaction<DB>,
  id: string,
  status: string,
  deadline: string | null,
) {
  await sql`update events_day set staffing_status=${status},availability_deadline=${deadline}::timestamptz,updated_at=now() where id=${id}::uuid`.execute(
    db,
  );
}
