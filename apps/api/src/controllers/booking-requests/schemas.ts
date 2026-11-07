import { BOOKING_ESTIMATED_DURATIONS, MAX_EVENT_TYPE_LENGTH, MAX_CONTACT_NAME_LENGTH, MAX_PHONE_NUMBER_LENGTH, MAX_PREFERRED_VENUE_LOCATION_LENGTH, MAX_SPECIAL_REQUESTS_LENGTH, MAX_BOOKING_REASON_LENGTH, MAX_BOOKING_NOTES_LENGTH } from "@event-management/contracts/limits/booking-requests";
import { z } from "@hono/zod-openapi";
import { priceSchema } from "../packages/schemas.js";
const text = (max: number) => z.string().trim().min(1).max(max);
export const statusSchema = z.enum(["under_review", "needs_details", "accepted", "declined", "cancelled"]);
export const estimatedDurationSchema = z.enum(BOOKING_ESTIMATED_DURATIONS);
export const createSchema = z.object({
  packageId: z.string().uuid(), packageUpdatedAt: z.string().datetime().optional(), eventType: text(MAX_EVENT_TYPE_LENGTH),
  preferredDate: z.iso.date().refine(value => !value.startsWith("0000-"), "Invalid date"), estimatedDuration: estimatedDurationSchema.default("undecided"),
  estimatedDurationDays: z.number().int().min(8).max(2147483647).nullable().optional(),
  guestCount: z.number().int().positive().max(2147483647).nullable().optional(), contactName: text(MAX_CONTACT_NAME_LENGTH), phoneNumber: text(MAX_PHONE_NUMBER_LENGTH), preferredVenueLocation: z.string().trim().max(MAX_PREFERRED_VENUE_LOCATION_LENGTH).nullable().optional(),
  specialRequests: z.string().trim().max(MAX_SPECIAL_REQUESTS_LENGTH).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.estimatedDuration === "more_than_1_week" && value.estimatedDurationDays == null) {
    ctx.addIssue({ code: "custom", message: "Enter the event length in days", path: ["estimatedDurationDays"] });
  } else if (value.estimatedDuration !== "more_than_1_week" && value.estimatedDurationDays != null) {
    ctx.addIssue({ code: "custom", message: "Exact days are only allowed for more than 1 week", path: ["estimatedDurationDays"] });
  }
});
export const updateStatusSchema = z.object({ status: statusSchema, reason: z.string().trim().max(MAX_BOOKING_REASON_LENGTH).nullable().optional().describe("Required for needs_details, declined, and cancelled") }).refine(value => !["needs_details", "declined", "cancelled"].includes(value.status) || Boolean(value.reason), { message: "A reason is required for this status", path: ["reason"] });
export const cancelSchema = z.object({ reason: z.string().trim().min(1, "A cancellation reason is required").max(MAX_BOOKING_REASON_LENGTH) });
export const idParams = z.object({ id: z.string().uuid() });
export const packageInclusionsSchema = z.array(z.object({ serviceId: z.string().uuid(), name: z.string(), role: z.enum(["included", "optional"]), sortOrder: z.number().int() }));
export const updateDetailsSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  eventType: text(MAX_EVENT_TYPE_LENGTH).optional(),
  preferredDate: z.iso.date().refine(value => !value.startsWith("0000-"), "Invalid date").optional(),
  estimatedDuration: estimatedDurationSchema.optional(),
  estimatedDurationDays: z.number().int().min(8).max(2147483647).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  guestCount: z.number().int().positive().max(2147483647).nullable().optional(),
  preferredVenueLocation: z.string().trim().max(MAX_PREFERRED_VENUE_LOCATION_LENGTH).nullable().optional(),
  notes: z.string().trim().max(MAX_BOOKING_NOTES_LENGTH).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.estimatedDuration === "more_than_1_week" && value.estimatedDurationDays == null) {
    ctx.addIssue({ code: "custom", message: "Enter the event length in days", path: ["estimatedDurationDays"] });
  } else if (value.estimatedDuration !== undefined && value.estimatedDuration !== "more_than_1_week" && value.estimatedDurationDays != null) {
    ctx.addIssue({ code: "custom", message: "Exact days are only allowed for more than 1 week", path: ["estimatedDurationDays"] });
  }
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    ctx.addIssue({ code: "custom", message: "End time must be after the start time", path: ["endsAt"] });
  }
  if (!Object.keys(value).some(key => key !== "expectedUpdatedAt")) {
    ctx.addIssue({ code: "custom", message: "Provide at least one detail field", path: [] });
  }
});
export const bookingSchema = z.object({
  id: z.string().uuid(), reference: z.string(), customerId: z.string().uuid(), packageId: z.string().uuid(), packagePrice: priceSchema.nullable(), packageMaxGuests: z.number().int().positive().nullable(),
  packageType: z.enum(["catalog", "custom"]), packageUpdatedAt: z.string(),
  packageName: z.string(), eventType: z.string(), preferredDate: z.string(), estimatedDuration: estimatedDurationSchema, startsAt: z.string().nullable(), endsAt: z.string().nullable(), guestCount: z.number().nullable(),
  estimatedDurationDays: z.number().int().min(8).nullable(),
  contactName: z.string(), phoneNumber: z.string(), preferredVenueLocation: z.string().nullable(), packageInclusions: packageInclusionsSchema, specialRequests: z.string().nullable(),
  status: statusSchema, outOfRange: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
  notes: z.string().nullable(), updatedBy: z.string().uuid().nullable(), updatedByName: z.string().nullable(),
  statusHistory: z.array(z.object({ status: statusSchema, reason: z.string().nullable(), changedBy: z.string().uuid(), createdAt: z.string() })),
});
export type CreateInput = z.infer<typeof createSchema>;
export type Status = z.infer<typeof statusSchema>;
export type UpdateDetailsInput = z.infer<typeof updateDetailsSchema>;
