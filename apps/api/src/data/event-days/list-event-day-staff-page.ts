import { sql } from "kysely";
import type { Database } from "./types.js";
export type StaffPosition = { name: string; id: string };
export async function listEventDayStaffPageData(
  db: Database,
  id: string,
  limit: number,
  cursor?: StaffPosition,
) {
  return (
    await sql<{
      staff_id: string;
      staff_name: string;
      eligible: boolean;
      assignment_role: "coordinator" | "helper" | null;
      assignment_status: "confirmed" | "cancelled" | null;
    }>`select a.staff_id,coalesce(u.display_name,'Staff') as staff_name,u.role='staff' as eligible,s.role as assignment_role,s.status as assignment_status
    from event_staff_availability a join users u on u.id=a.staff_id
    left join event_staffs s on s.event_day_id=a.event_day_id and s.staff_id=a.staff_id
    where a.event_day_id=${id}::uuid and a.response='available'
    ${cursor ? sql`and (coalesce(u.display_name,'Staff'),a.staff_id)>(${cursor.name},${cursor.id}::uuid)` : sql``}
    order by coalesce(u.display_name,'Staff'),a.staff_id limit ${limit + 1}`.execute(
      db,
    )
  ).rows;
}
