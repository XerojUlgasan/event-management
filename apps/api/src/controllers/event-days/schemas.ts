import { z } from "@hono/zod-openapi";
import * as service from "../../services/event-days/event-days.js";
import { errors, json } from "../booking-requests/http.js";
export const id = z.string().uuid(),
  params = z.object({ id });
export const instant = z.iso.datetime({ offset: true });
export const schedule = z.object({
  day: z.iso.date(),
  startsAt: instant,
  endsAt: instant,
  staffingStatus: z.enum(["draft", "open"]),
  availabilityDeadline: instant.nullable(),
});
export const dto = z.object({
  id,
  bookingRequestId: id,
  eventType: z.string(),
  timezone: z.string(),
  day: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.string(),
  staffingStatus: z.string(),
  availabilityDeadline: z.string().nullable(),
  replacementEventDayId: id.nullable(),
  availability: z.array(
    z.object({
      staffId: id,
      staffName: z.string(),
      response: z.string(),
      respondedAt: z.string(),
    }),
  ),
  assignments: z.array(
    z.object({
      staffId: id,
      staffName: z.string(),
      role: z.string(),
      status: z.string(),
      assignedAt: z.string(),
    }),
  ),
  ownAvailability: z.string().nullable(),
  ownAssignment: z.object({ role: z.string(), status: z.string() }).nullable(),
  eligibleStaff: z.array(z.object({ id, displayName: z.string() })),
});
export const response = {
  200: { content: json(z.object({ eventDay: dto })), description: "Event day" },
  ...errors,
};
export const listResponse = {
  200: {
    content: json(z.object({ eventDays: z.array(dto) })),
    description: "Event days",
  },
  ...errors,
};
export const tags = ["Event staffing"];
export function errorResponse(error: unknown) {
  if (error instanceof service.EventDayError) return error;
  throw error;
}
