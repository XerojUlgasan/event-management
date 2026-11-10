import { sql } from "kysely";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { DayRow } from "./types.js";

export async function hasOverlappingAssignmentData(
  db: Transaction<DB>,
  day: DayRow,
  staffId: string,
) {
  const result = await sql<{
    exists: boolean;
  }>`select exists(select 1 from event_staffs s join events_day d on d.id=s.event_day_id where s.staff_id=${staffId}::uuid and s.status='confirmed' and d.id<>${day.id}::uuid and d.starts_at<${day.ends_at} and d.ends_at>${day.starts_at}) as exists`.execute(
    db,
  );
  const row = result.rows[0];
  if (!row) throw new Error("Overlap query returned no result");
  return row.exists;
}
