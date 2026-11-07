import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { AssignmentResponse } from "@event-management/contracts/limits/events";
import {
  listStaffEventsData,
  upsertAssignmentData,
  updateAssignmentData,
} from "../../data/events/events.js";

const error = (message: string, status: 400 | 403 | 404 | 409) => ({ message, status });

// ─── Response mapper ──────────────────────────────────────────────────────────

type EventRow = Awaited<ReturnType<typeof listStaffEventsData>>[number];

function mapEvent(row: EventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    preferredDate: row.preferred_date,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    timeZone: row.time_zone,
    location: row.preferred_venue_location,
    guestCount: row.guest_count,
    status: row.status,
    specialRequests: row.special_requests,
    // invitation fields
    coordinatorId: row.coordinator_id,
    coordinatorName: row.coordinator_name,
    responseDeadline: row.response_deadline instanceof Date
      ? row.response_deadline.toISOString().slice(0, 10)
      : (row.response_deadline as string | null),
    teamPublished: row.team_published,
    staffDescription: row.staff_description,
    // this staff member's assignment
    assignmentId: row.assignment_id,
    response: row.response as AssignmentResponse | null,
    selectedAt: row.selected_at?.toISOString() ?? null,
  };
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function listStaffEventsService(db: Kysely<DB>, staffId: string) {
  const rows = await listStaffEventsData(db, staffId);
  return rows.map(mapEvent);
}

export async function respondToEventService(
  db: Kysely<DB>,
  bookingRequestId: string,
  staffId: string,
  response: AssignmentResponse | null,
) {
  return db.transaction().execute(async (trx) => {
    // If clearing the response, update only the response field.
    if (response === null) {
      const updated = await updateAssignmentData(trx, bookingRequestId, staffId, {
        response: null,
      });
      if (!updated) return error("Assignment not found", 404);
      return { response: null as AssignmentResponse | null };
    }

    // Upsert — create the row if it doesn't exist yet.
    await upsertAssignmentData(trx, {
      booking_request_id: bookingRequestId,
      staff_id: staffId,
      response,
    });

    return { response };
  });
}
