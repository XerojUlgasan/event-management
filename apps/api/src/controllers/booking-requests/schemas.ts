import { MAX_EVENT_TYPE_LENGTH, MAX_TIME_ZONE_LENGTH, MAX_CONTACT_NAME_LENGTH, MAX_PHONE_NUMBER_LENGTH, MAX_PREFERRED_VENUE_LOCATION_LENGTH, MAX_SPECIAL_REQUESTS_LENGTH, MAX_BOOKING_REASON_LENGTH } from "@event-management/contracts/limits/booking-requests";
import { z } from "@hono/zod-openapi";
const text = (max: number) => z.string().trim().min(1).max(max);
export const statusSchema = z.enum(["under_review", "needs_details", "accepted", "declined", "cancelled"]);
export const createSchema = z.object({
  packageId: z.string().uuid(), packageVersionId: z.string().uuid(), eventType: text(MAX_EVENT_TYPE_LENGTH),
  startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }),
  timeZone: text(MAX_TIME_ZONE_LENGTH).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid time zone"),
  guestCount: z.number().int().positive().max(2147483647), contactName: text(MAX_CONTACT_NAME_LENGTH), phoneNumber: text(MAX_PHONE_NUMBER_LENGTH),
  preferredVenueLocation: text(MAX_PREFERRED_VENUE_LOCATION_LENGTH), specialRequests: z.string().trim().max(MAX_SPECIAL_REQUESTS_LENGTH).nullable().optional(),
});
export const updateStatusSchema = z.object({ status: statusSchema, reason: z.string().trim().max(MAX_BOOKING_REASON_LENGTH).nullable().optional().describe("Required for needs_details, declined, and cancelled") }).refine(value => !["needs_details", "declined", "cancelled"].includes(value.status) || Boolean(value.reason), { message: "A reason is required for this status", path: ["reason"] });
export const cancelSchema = z.object({ reason: z.string().trim().min(1, "A cancellation reason is required").max(MAX_BOOKING_REASON_LENGTH) });
export const idParams = z.object({ id: z.string().uuid() });
export const bookingSchema = z.object({
  id: z.string().uuid(), reference: z.string(), customerId: z.string().uuid(), packageId: z.string().uuid(), packageVersionId: z.string().uuid(),
  packageName: z.string(), eventType: z.string(), startsAt: z.string(), endsAt: z.string(), timeZone: z.string(), guestCount: z.number(),
  contactName: z.string(), phoneNumber: z.string(), preferredVenueLocation: z.string(), specialRequests: z.string().nullable(),
  status: statusSchema, outOfRange: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
  statusHistory: z.array(z.object({ status: statusSchema, reason: z.string().nullable(), changedBy: z.string().uuid(), createdAt: z.string() })),
});
export type CreateInput = z.infer<typeof createSchema>;
export type Status = z.infer<typeof statusSchema>;
