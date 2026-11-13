import type { Selectable, Transaction } from "kysely";
import type { EventChecklist } from "@event-management/contracts/event-checklists";
import type { DB, EventChecklists } from "../../db/types.js";
import type { SessionContext } from "../../types/hono.js";
import { content } from "../../controllers/event-checklists/schemas.js";
import { findEventDayBookingData } from "../../data/event-days/find-event-day-booking.js";
import { lockBookingRequestData } from "../../data/event-days/lock-booking-request.js";
import { lockEventDayData } from "../../data/event-days/lock-event-day.js";
import { getEventChecklistData, getCoordinatorData } from "../../data/event-checklists/get-event-checklist.js";

export type Actor = SessionContext["user"];
export class ChecklistError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 | 409) { super(message); }
}
export const fail = (message: string, status: 400 | 403 | 404 | 409): never => { throw new ChecklistError(message, status); };
function isAdmin(actor: Actor) { return actor.role === "admin" && actor.staff_role === "System Administrator"; }
export function checklistDto(row: Selectable<EventChecklists>): EventChecklist {
  return { id: row.id, eventDayId: row.event_day_id, title: row.title, content: content.parse(row.content), revision: row.revision,
    coordinatorId: row.coordinator_id, sentBy: row.sent_by, sentAt: row.sent_at?.toISOString() ?? null,
    createdBy: row.created_by, updatedBy: row.updated_by, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export async function checklistContext(trx: Transaction<DB>, id: string, actor: Actor, writing: boolean) {
  const admin = isAdmin(actor);
  if (!admin && actor.role !== "staff") fail("Checklist access required", 403);
  const ref = await findEventDayBookingData(trx, id);
  if (!ref) return fail("Event day not found", 404);
  await lockBookingRequestData(trx, ref.booking_request_id);
  const day = await lockEventDayData(trx, id);
  if (!day) return fail("Event day not found", 404);
  const coordinator = await getCoordinatorData(trx, id);
  const row = await getEventChecklistData(trx, id);
  if (!admin && (day.status !== "scheduled" || day.booking_status !== "accepted" || !row?.sent_at || row.coordinator_id !== actor.id || coordinator?.staff_id !== actor.id))
    return fail("Checklist not found or no longer shared with you", 404);
  if (writing && (day.status !== "scheduled" || day.booking_status !== "accepted")) fail("Checklist changes require a scheduled day and accepted request", 409);
  return { admin, row, coordinator };
}
