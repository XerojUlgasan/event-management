import type { Insertable, Kysely, Transaction, Updateable } from "kysely";
import type { DB, EventStaffAssignments } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

// ─── Staff event list ─────────────────────────────────────────────────────────
// Returns accepted booking requests that have an event_checklists row
// (which signals the event has been published to staff), with this staff
// member's assignment row joined in.

export const listStaffEventsData = (db: Database, staffId: string) =>
  db
    .selectFrom("booking_requests as br")
    .innerJoin("event_checklists as ec", "ec.booking_request_id", "br.id")
    .innerJoin("users as coordinator", "coordinator.id", "ec.coordinator_id")
    .leftJoin("event_staff_assignments as esa", (join) =>
      join
        .onRef("esa.booking_request_id", "=", "br.id")
        .on("esa.staff_id", "=", staffId),
    )
    .select([
      "br.id",
      "br.event_type",
      "br.preferred_date",
      "br.starts_at",
      "br.ends_at",
      "br.time_zone",
      "br.preferred_venue_location",
      "br.guest_count",
      "br.status",
      "br.special_requests",
      "ec.coordinator_id",
      "ec.response_deadline",
      "ec.team_published",
      "ec.staff_description",
      "coordinator.display_name as coordinator_name",
      "esa.id as assignment_id",
      "esa.response",
      "esa.selected_at",
    ])
    .where("br.status", "=", "accepted")
    .orderBy("br.preferred_date", "asc")
    .orderBy("br.id", "asc")
    .execute();

// ─── Staff assignment ─────────────────────────────────────────────────────────

export const findAssignmentData = (
  db: Database,
  bookingRequestId: string,
  staffId: string,
) =>
  db
    .selectFrom("event_staff_assignments")
    .selectAll()
    .where("booking_request_id", "=", bookingRequestId)
    .where("staff_id", "=", staffId)
    .executeTakeFirst();

export const upsertAssignmentData = (
  db: Transaction<DB>,
  values: Insertable<EventStaffAssignments>,
) =>
  db
    .insertInto("event_staff_assignments")
    .values(values)
    .onConflict((oc) =>
      oc.constraint("event_staff_assignments_booking_staff_unique").doUpdateSet({
        response: values.response,
        updated_at: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();

export const updateAssignmentData = (
  db: Transaction<DB>,
  bookingRequestId: string,
  staffId: string,
  patch: Updateable<EventStaffAssignments>,
) =>
  db
    .updateTable("event_staff_assignments")
    .set({ ...patch, updated_at: new Date() })
    .where("booking_request_id", "=", bookingRequestId)
    .where("staff_id", "=", staffId)
    .returningAll()
    .executeTakeFirst();

// ─── Admin: publish team + manage assignments ─────────────────────────────────

export const listAssignmentsData = (db: Database, bookingRequestId: string) =>
  db
    .selectFrom("event_staff_assignments")
    .selectAll()
    .where("booking_request_id", "=", bookingRequestId)
    .execute();

export const setTeamPublishedData = (
  db: Transaction<DB>,
  bookingRequestId: string,
  teamPublished: boolean,
) =>
  db
    .updateTable("event_checklists")
    .set({ team_published: teamPublished, updated_at: new Date() })
    .where("booking_request_id", "=", bookingRequestId)
    .returningAll()
    .executeTakeFirst();
