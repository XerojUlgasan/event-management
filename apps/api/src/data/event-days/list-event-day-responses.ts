import { sql } from "kysely";
import type { Database, AvailabilityRow, AssignmentRow } from "./types.js";

export async function listEventDayResponsesData(db: Database, ids: string[]) {
  if (!ids.length)
    return {
      availability: [] as AvailabilityRow[],
      assignments: [] as AssignmentRow[],
    };
  const [a, s] = await Promise.all([
    sql<AvailabilityRow>`select a.event_day_id,a.staff_id,coalesce(u.display_name, 'Staff') as staff_name,a.response,a.responded_at from event_staff_availability a join users u on u.id=a.staff_id where a.event_day_id in (${sql.join(ids.map((id) => sql`${id}::uuid`))})`.execute(
      db,
    ),
    sql<AssignmentRow>`select s.event_day_id,s.staff_id,coalesce(u.display_name, 'Staff') as staff_name,s.role,s.status,s.assigned_at from event_staffs s join users u on u.id=s.staff_id where s.event_day_id in (${sql.join(ids.map((id) => sql`${id}::uuid`))})`.execute(
      db,
    ),
  ]);
  return { availability: a.rows, assignments: s.rows };
}
