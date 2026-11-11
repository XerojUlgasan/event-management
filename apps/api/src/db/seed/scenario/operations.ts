import { sql } from "kysely";
import type { SeedDb } from "../context.js";
import { expectCount, insertIfNew, scenarioId } from "../context.js";
import type { ScenarioBooking, ScenarioEventDay } from "./activity.js";
import type { ScenarioUser } from "./users.js";

type Pair = { day: ScenarioEventDay; staffId: string; response: "available" | "unavailable" };
type Assignment = { day: ScenarioEventDay; staffId: string; role: "coordinator" | "helper"; status: "confirmed" | "cancelled" };

function planStaff(days: ScenarioEventDay[], staff: ScenarioUser[]) {
  if (staff.length < 2) throw new Error("Scenario staffing requires at least two staff accounts");
  const closed = days.filter((day) => day.status === "scheduled" && day.staffingStatus === "closed");
  const open = days.filter((day) => day.staffingStatus === "open");
  if (closed.length !== 40 || open.length < 20) {
    throw new Error(`Scenario staffing expected 40 closed days and at least 20 open days, received ${closed.length} closed and ${open.length} open`);
  }
  const availability: Pair[] = [];
  const assignments: Assignment[] = [];
  const confirmedOnDate = new Map<string, Set<string>>();
  for (const day of closed) {
    const busy = confirmedOnDate.get(day.day) ?? new Set<string>();
    const free = staff.filter((person) => !busy.has(person.id));
    const coordinator = free[0];
    const helper = free[1];
    if (!coordinator || !helper) throw new Error(`Scenario staffing has no free pair on ${day.day}`);
    busy.add(coordinator.id);
    busy.add(helper.id);
    confirmedOnDate.set(day.day, busy);
    availability.push({ day, staffId: coordinator.id, response: "available" }, { day, staffId: helper.id, response: "available" });
    assignments.push(
      { day, staffId: coordinator.id, role: "coordinator", status: "confirmed" },
      { day, staffId: helper.id, role: "helper", status: "confirmed" },
    );
  }
  const responder = staff[0];
  if (!responder) throw new Error("Scenario staffing is missing a staff account");
  for (const day of open.slice(0, 20)) availability.push({ day, staffId: responder.id, response: "unavailable" });
  const historical = days.filter((day) => day.status === "moved" || day.status === "cancelled" || day.extraDraft);
  for (const day of historical) {
    assignments.push({
      day,
      staffId: responder.id,
      role: day.status === "moved" ? "coordinator" : "helper",
      status: "cancelled",
    });
  }
  expectCount("availability", availability.length);
  expectCount("assignments", assignments.length);
  return { availability, assignments };
}

export async function seedScenarioOperations(
  db: SeedDb,
  input: { bookings: ScenarioBooking[]; users: ScenarioUser[]; now: Date },
) {
  const admin = input.users.find((user) => user.role === "admin");
  const staff = input.users.filter((user) => user.role === "staff");
  if (!admin) throw new Error("Scenario staffing requires an administrator");
  const days = input.bookings.flatMap((booking) => booking.eventDays);
  expectCount("event days", days.length);
  const acceptedIds = new Set(input.bookings.filter((booking) => booking.status === "accepted").map((booking) => booking.id));
  if (days.some((day) => !acceptedIds.has(day.bookingId))) throw new Error("Operational days belong only on accepted booking requests");
  const { availability, assignments } = planStaff(days, staff);
  let eventDays = 0;
  let responses = 0;
  let eventStaff = 0;
  const ordered = [...days.filter((day) => day.status !== "moved"), ...days.filter((day) => day.status === "moved")];

  for (const day of ordered) {
    const inserted = await db.insertInto("events_day").values({
      id: day.id,
      booking_request_id: day.bookingId,
      day: sql`${day.day}::date`,
      starts_at: day.startsAt,
      ends_at: day.endsAt,
      status: day.status,
      staffing_status: day.staffingStatus,
      availability_deadline: day.availabilityDeadline ? new Date(day.availabilityDeadline) : null,
      replacement_event_day_id: day.replacementEventDayId,
      created_at: input.now,
      updated_at: input.now,
    }).onConflict((conflict) => conflict.column("id").doNothing()).returning("id").executeTakeFirst();
    if (inserted) eventDays += 1;
  }
  for (const response of availability) {
    if (await insertIfNew(db, "event_staff_availability", {
      id: scenarioId(`availability:${response.day.id}:${response.staffId}`),
      event_day_id: response.day.id,
      staff_id: response.staffId,
      response: response.response,
      responded_at: input.now,
      updated_at: input.now,
    })) responses += 1;
  }
  for (const assignment of assignments) {
    if (await insertIfNew(db, "event_staffs", {
      id: scenarioId(`assignment:${assignment.day.id}:${assignment.staffId}`),
      event_day_id: assignment.day.id,
      staff_id: assignment.staffId,
      role: assignment.role,
      status: assignment.status,
      assigned_by: admin.id,
      assigned_at: input.now,
      updated_at: input.now,
    })) eventStaff += 1;
  }
  return { inserted: { eventDays, availability: responses, eventStaff } };
}
