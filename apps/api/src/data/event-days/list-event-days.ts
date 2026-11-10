import { sql } from "kysely";
import type { Database, DayRow } from "./types.js";

export async function listEventDaysData(
  db: Database,
  bookingId?: string,
  staffId?: string,
  assignmentsOnly = false,
  dayId?: string,
) {
  return (
    await sql<DayRow>`select d.id, d.booking_request_id, b.event_type, b.reference as booking_reference, b.package_name, b.time_zone, d.day::text as day, d.starts_at, d.ends_at, d.status, d.staffing_status, d.availability_deadline, d.replacement_event_day_id, b.status as booking_status from events_day d join booking_requests b on b.id=d.booking_request_id where (${dayId ?? null}::uuid is null or d.id=${dayId ?? null}::uuid) and (${bookingId ?? null}::uuid is null or d.booking_request_id=${bookingId ?? null}::uuid) and (${staffId ?? null}::uuid is null or ${assignmentsOnly} = false or exists(select 1 from event_staffs s where s.event_day_id=d.id and s.staff_id=${staffId ?? null}::uuid)) ${staffId && !assignmentsOnly ? sql`and (d.status='scheduled' and d.staffing_status='open' or exists(select 1 from event_staffs s where s.event_day_id=d.id and s.staff_id=${staffId}::uuid) or exists(select 1 from event_staff_availability a where a.event_day_id=d.id and a.staff_id=${staffId}::uuid))` : sql``} order by d.starts_at, d.id`.execute(
      db,
    )
  ).rows;
}
