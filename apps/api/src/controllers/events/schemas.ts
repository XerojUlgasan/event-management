import { z } from "@hono/zod-openapi";
import { ASSIGNMENT_RESPONSES } from "@event-management/contracts/limits/events";

export const bookingRequestIdParams = z.object({ bookingRequestId: z.string().uuid() });

export const respondSchema = z.object({
  // null clears a previous response
  response: z.enum(ASSIGNMENT_RESPONSES).nullable(),
});

export const staffEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  preferredDate: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  timeZone: z.string(),
  location: z.string().nullable(),
  guestCount: z.number().int().nullable(),
  status: z.string(),
  specialRequests: z.string().nullable(),
  coordinatorId: z.string().uuid(),
  coordinatorName: z.string().nullable(),
  responseDeadline: z.string().nullable(),
  teamPublished: z.boolean(),
  staffDescription: z.string().nullable(),
  assignmentId: z.string().uuid().nullable(),
  response: z.enum(ASSIGNMENT_RESPONSES).nullable(),
  selectedAt: z.string().nullable(),
});
