import { sql } from "kysely";
import type { Database, DayRow } from "./types.js";

export type StaffDayFilter = {
  search: string;
  filter: "all" | "open" | "responded";
  date?: string;
};
export type StaffDayPosition = { startsAt: string; id: string };

function predicate(
  staffId: string,
  assignmentsOnly: boolean,
  filter: StaffDayFilter,
) {
  return sql`(${assignmentsOnly}
    and exists(select 1 from event_staffs s where s.event_day_id=d.id and s.staff_id=${staffId}::uuid)
    or not ${assignmentsOnly} and (
      d.status='scheduled' and d.staffing_status='open'
      or exists(select 1 from event_staffs s where s.event_day_id=d.id and s.staff_id=${staffId}::uuid)
      or exists(select 1 from event_staff_availability a where a.event_day_id=d.id and a.staff_id=${staffId}::uuid)))
    and position(lower(${filter.search}) in lower(b.event_type)) > 0
    and (${filter.date ?? null}::date is null or d.day=${filter.date ?? null}::date)
    and (${filter.filter}='all'
      or ${filter.filter}='responded' and exists(select 1 from event_staff_availability a where a.event_day_id=d.id and a.staff_id=${staffId}::uuid)
      or ${filter.filter}='open' and b.status='accepted' and d.status='scheduled' and d.staffing_status='open' and (d.availability_deadline is null or d.availability_deadline > now()))`;
}

export async function listStaffEventDaysPageData(
  db: Database,
  staffId: string,
  assignmentsOnly: boolean,
  filter: StaffDayFilter,
  limit: number,
  cursor?: StaffDayPosition,
) {
  return (
    await sql<
      DayRow & { cursor_starts_at: string }
    >`select d.id,d.booking_request_id,b.event_type,b.reference as booking_reference,b.package_name,b.time_zone,d.day::text as day,d.starts_at,d.ends_at,d.status,d.staffing_status,d.availability_deadline,d.replacement_event_day_id,b.status as booking_status,
    to_char(d.starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_starts_at
    from events_day d join booking_requests b on b.id=d.booking_request_id
    where ${predicate(staffId, assignmentsOnly, filter)}
    ${cursor ? sql`and (d.starts_at,d.id)>(${cursor.startsAt}::timestamptz,${cursor.id}::uuid)` : sql``}
    order by d.starts_at,d.id limit ${limit + 1}`.execute(db)
  ).rows;
}

export async function staffEventDayCalendarData(
  db: Database,
  staffId: string,
  filter: StaffDayFilter,
  month: string,
) {
  return (
    await sql<{
      day: string;
      count: number;
    }>`select d.day::text as day,count(*)::int as count
    from events_day d join booking_requests b on b.id=d.booking_request_id
    where ${predicate(staffId, false, { ...filter, date: undefined })}
    and d.day >= ${`${month}-01`}::date and d.day < ${`${month}-01`}::date + interval '1 month'
    group by d.day order by d.day`.execute(db)
  ).rows;
}
