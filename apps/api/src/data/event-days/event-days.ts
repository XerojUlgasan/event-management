import { sql, type Kysely, type Selectable, type Transaction } from "kysely";
import type {
  BookingRequests,
  DB,
  EventsDay,
  EventStaffAvailability,
  EventStaffs,
} from "../../db/types.js";
export type Database = Kysely<DB> | Transaction<DB>;
export type DayRow = Pick<
  Selectable<EventsDay>,
  | "id"
  | "booking_request_id"
  | "starts_at"
  | "ends_at"
  | "status"
  | "staffing_status"
  | "availability_deadline"
  | "replacement_event_day_id"
> &
  Pick<Selectable<BookingRequests>, "event_type" | "time_zone"> & {
    day: string;
    booking_status: string;
  };
export type AvailabilityRow = Pick<
  Selectable<EventStaffAvailability>,
  "event_day_id" | "staff_id" | "response" | "responded_at"
> & { staff_name: string };
export type AssignmentRow = Pick<
  Selectable<EventStaffs>,
  "event_day_id" | "staff_id" | "role" | "status" | "assigned_at"
> & { staff_name: string };
export async function listDaysData(
  db: Database,
  bookingId?: string,
  staffId?: string,
  assignmentsOnly = false,
  dayId?: string,
) {
  return (
    await sql<DayRow>`select d.id, d.booking_request_id, b.event_type, b.time_zone, d.day::text as day, d.starts_at, d.ends_at, d.status, d.staffing_status, d.availability_deadline, d.replacement_event_day_id, b.status as booking_status from events_day d join booking_requests b on b.id=d.booking_request_id where (${dayId ?? null}::uuid is null or d.id=${dayId ?? null}::uuid) and (${bookingId ?? null}::uuid is null or d.booking_request_id=${bookingId ?? null}::uuid) and (${staffId ?? null}::uuid is null or ${assignmentsOnly} = false or exists(select 1 from event_staffs s where s.event_day_id=d.id and s.staff_id=${staffId ?? null}::uuid)) ${staffId && !assignmentsOnly ? sql`and (d.status='scheduled' and d.staffing_status='open' or exists(select 1 from event_staffs s where s.event_day_id=d.id and s.staff_id=${staffId}::uuid) or exists(select 1 from event_staff_availability a where a.event_day_id=d.id and a.staff_id=${staffId}::uuid))` : sql``} order by d.starts_at, d.id`.execute(
      db,
    )
  ).rows;
}
export async function getDayData(db: Database, id: string) {
  return (await listDaysData(db, undefined, undefined, false, id))[0];
}
export async function relatedData(db: Database, ids: string[]) {
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
export async function eligibleStaffData(db: Database) {
  return (
    await sql<{
      id: string;
      display_name: string;
    }>`select id,coalesce(display_name,'Staff') as display_name from users where role='staff' order by display_name,id`.execute(
      db,
    )
  ).rows;
}
export function lockBookingData(db: Transaction<DB>, id: string) {
  return db
    .selectFrom("booking_requests")
    .select(["id", "status", "time_zone"])
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
}
export function lockDayData(db: Transaction<DB>, id: string) {
  return db
    .selectFrom("events_day")
    .select("booking_request_id")
    .where("id", "=", id)
    .executeTakeFirst();
}
export async function lockDayRowData(db: Transaction<DB>, id: string) {
  await db
    .selectFrom("events_day")
    .select("id")
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
  return getDayData(db, id);
}
export function lockStaffData(db: Transaction<DB>, id: string) {
  return db
    .selectFrom("users")
    .select("role")
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
}
export async function createDayData(
  db: Transaction<DB>,
  bookingId: string,
  input: {
    day: string;
    startsAt: string;
    endsAt: string;
    staffingStatus: string;
    availabilityDeadline: string | null;
  },
) {
  const row = await db
    .insertInto("events_day")
    .values({
      booking_request_id: bookingId,
      day: sql`${input.day}::date`,
      starts_at: new Date(input.startsAt),
      ends_at: new Date(input.endsAt),
      staffing_status: input.staffingStatus,
      availability_deadline: input.availabilityDeadline
        ? new Date(input.availabilityDeadline)
        : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
export async function setStaffingData(
  db: Transaction<DB>,
  id: string,
  status: string,
  deadline: string | null,
) {
  await sql`update events_day set staffing_status=${status},availability_deadline=${deadline}::timestamptz,updated_at=now() where id=${id}::uuid`.execute(
    db,
  );
}
export async function upsertAvailabilityData(
  db: Transaction<DB>,
  id: string,
  staffId: string,
  response: string,
) {
  await sql`insert into event_staff_availability(event_day_id,staff_id,response) values (${id}::uuid,${staffId}::uuid,${response}) on conflict(event_day_id,staff_id) do update set response=excluded.response,responded_at=now(),updated_at=now()`.execute(
    db,
  );
}
export async function upsertAssignmentData(
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
export async function overlapData(
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
export async function endDayData(
  db: Transaction<DB>,
  id: string,
  status: "cancelled" | "moved",
  replacementId: string | null,
) {
  await sql`update event_staffs set status='cancelled',updated_at=now() where event_day_id=${id}::uuid and status='confirmed'`.execute(
    db,
  );
  await sql`update events_day set status=${status},staffing_status='closed',replacement_event_day_id=${replacementId}::uuid,updated_at=now() where id=${id}::uuid`.execute(
    db,
  );
}

// Call after locking the parent booking; keep child locks in a stable order.
export function lockScheduledDaysData(db: Transaction<DB>, bookingId: string) {
  return db
    .selectFrom("events_day")
    .select("id")
    .where("booking_request_id", "=", bookingId)
    .where("status", "=", "scheduled")
    .orderBy("id")
    .forUpdate()
    .execute();
}
