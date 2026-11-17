import { z } from "@hono/zod-openapi";
import * as service from "../../services/event-days/event-days.js";
import { errors, json } from "../booking-requests/http.js";
export const id = z.string().uuid(),
  params = z.object({ id });
export const instant = z.iso.datetime({ offset: true });
export const schedule = z.strictObject({
  day: z.iso.date(),
  startsAt: instant,
  endsAt: instant,
});
export const dto = z.object({
  id,
  bookingRequestId: id,
  bookingReference: z.string(),
  packageName: z.string().nullable(),
  eventType: z.string(),
  timezone: z.string(),
  day: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.string(),
  replacementEventDayId: id.nullable(),
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
export const tags = ["Event days"];
export function errorResponse(error: unknown) {
  if (error instanceof service.EventDayError) return error;
  throw error;
}
