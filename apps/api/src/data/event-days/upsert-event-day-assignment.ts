import { sql } from "kysely";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function upsertEventDayAssignmentData(
  db: Transaction<DB>,
  id: string,
  staffId: string,
  actorId: string,
  role: string,
  status: string,
) {
  await sql`insert into event_staffs(event_day_id,staff_id,assigned_by,role,status) values (${id}::uuid,${staffId}::uuid,${actorId}::uuid,${role},${status}) on conflict(event_day_id,staff_id) do update set assigned_by=excluded.assigned_by,role=excluded.role,status=excluded.status,assigned_at=now(),updated_at=now()`.execute(
    db,
  );
}
