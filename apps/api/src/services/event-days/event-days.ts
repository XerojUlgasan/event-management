import type { Transaction } from "kysely";
import type { DayRow } from "../../data/event-days/types.js";
import type { Database } from "../../data/event-days/types.js";
import { listEventDayResponsesData } from "../../data/event-days/list-event-day-responses.js";
import { listEligibleStaffData } from "../../data/event-days/list-eligible-staff.js";
import { getEventDayData } from "../../data/event-days/get-event-day.js";
import { findEventDayBookingData } from "../../data/event-days/find-event-day-booking.js";
import { lockBookingRequestData } from "../../data/event-days/lock-booking-request.js";
import { lockEventDayData } from "../../data/event-days/lock-event-day.js";
import type { DB } from "../../db/types.js";

export type Schedule = {
  day: string;
  startsAt: string;
  endsAt: string;
  staffingStatus: "draft" | "open";
  availabilityDeadline: string | null;
};
export class EventDayError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409,
  ) {
    super(message);
  }
}
export const fail = (message: string, status: 400 | 404 | 409): never => {
  throw new EventDayError(message, status);
};
export function validateSchedule(input: Schedule, timeZone: string) {
  const start = new Date(input.startsAt),
    end = new Date(input.endsAt);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(start);
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  if (`${part("year")}-${part("month")}-${part("day")}` !== input.day)
    fail("Day must match the start date in the booking time zone", 400);
  if (end <= start) fail("End must be after start", 400);
  if (
    input.staffingStatus === "open" &&
    (!input.availabilityDeadline ||
      new Date(input.availabilityDeadline) <= new Date())
  )
    fail("An open staffing deadline must be in the future", 400);
}
export function effectiveStatus(day: DayRow) {
  if (day.booking_status !== "accepted") return "closed";
  return day.staffing_status === "open" &&
    day.availability_deadline &&
    day.availability_deadline <= new Date()
    ? "closed"
    : day.staffing_status;
}
export async function responses(
  db: Database,
  days: DayRow[],
  staffId?: string,
) {
  const { availability, assignments } = await listEventDayResponsesData(
    db,
    days.map((d) => d.id),
  );
  const staff = staffId ? [] : await listEligibleStaffData(db);
  return days.map((day) => {
    const a = availability.filter((x) => x.event_day_id === day.id),
      s = assignments.filter((x) => x.event_day_id === day.id);
    const ownA = a.find((x) => x.staff_id === staffId),
      ownS = s.find((x) => x.staff_id === staffId);
    return {
      id: day.id,
      bookingRequestId: day.booking_request_id,
      eventType: day.event_type,
      timezone: day.time_zone,
      day: day.day,
      startsAt: day.starts_at.toISOString(),
      endsAt: day.ends_at.toISOString(),
      status: day.status,
      staffingStatus: effectiveStatus(day),
      availabilityDeadline: day.availability_deadline?.toISOString() ?? null,
      replacementEventDayId: day.replacement_event_day_id,
      availability: (staffId ? [] : a).map((x) => ({
        staffId: x.staff_id,
        staffName: x.staff_name,
        response: x.response,
        respondedAt: x.responded_at.toISOString(),
      })),
      assignments: (staffId
        ? s.filter((x) => x.status === "confirmed" || x.staff_id === staffId)
        : s
      ).map((x) => ({
        staffId: x.staff_id,
        staffName: x.staff_name,
        role: x.role,
        status: x.status,
        assignedAt: x.assigned_at.toISOString(),
      })),
      ownAvailability: ownA?.response ?? null,
      ownAssignment: ownS ? { role: ownS.role, status: ownS.status } : null,
      eligibleStaff: staff.map((x) => ({
        id: x.id,
        displayName: x.display_name,
      })),
    };
  });
}
export async function one(db: Database, id: string, staffId?: string) {
  const day = await getEventDayData(db, id);
  if (!day) return fail("Event day not found", 404);
  const result = (await responses(db, [day], staffId))[0];
  if (!result) throw new Error("Event day response missing");
  return result;
}
export async function lockExisting(
  trx: Transaction<DB>,
  id: string,
  requireAccepted = true,
) {
  const ref = await findEventDayBookingData(trx, id);
  if (!ref) return fail("Event day not found", 404);
  const booking = await lockBookingRequestData(trx, ref.booking_request_id);
  if (!booking || (requireAccepted && booking.status !== "accepted"))
    return fail("Booking request must be accepted", 409);
  const day = await lockEventDayData(trx, id);
  if (!day) return fail("Event day not found", 404);
  if (day.status !== "scheduled")
    return fail("Event day is no longer scheduled", 409);
  return day;
}
