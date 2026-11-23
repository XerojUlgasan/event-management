import { sql } from "kysely";
import type { Database, DayRow } from "./types.js";

export async function listEventDaysData(
  db: Database,
  bookingId?: string,
  dayId?: string,
) {
  return (
    await sql<DayRow>`select d.id, d.booking_request_id, b.event_type, b.reference as booking_reference, p.name as package_name, b.time_zone, d.day::text as day, d.starts_at, d.ends_at, d.status, d.replacement_event_day_id, b.status as booking_status from events_day d join booking_requests b on b.id=d.booking_request_id and b.submitted_at is not null left join packages p on p.id=b.package_id where (${dayId ?? null}::uuid is null or d.id=${dayId ?? null}::uuid) and (${bookingId ?? null}::uuid is null or d.booking_request_id=${bookingId ?? null}::uuid) order by d.starts_at, d.id`.execute(
      db,
    )
  ).rows;
}
