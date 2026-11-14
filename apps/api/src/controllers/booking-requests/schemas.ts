import {
  BOOKING_ESTIMATED_DURATIONS,
  MAX_EVENT_TYPE_LENGTH,
  MAX_TIME_ZONE_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_PHONE_NUMBER_LENGTH,
  MAX_SPECIAL_REQUESTS_LENGTH,
  MAX_BOOKING_REASON_LENGTH,
} from "@event-management/contracts/limits/booking-requests";
import { z } from "@hono/zod-openapi";
import { priceSchema } from "../packages/schemas.js";
const text = (max: number) => z.string().trim().min(1).max(max);
export const statusSchema = z.enum([
  "under_review",
  "needs_details",
  "accepted",
  "declined",
  "cancelled",
]);
export const estimatedDurationSchema = z.enum(BOOKING_ESTIMATED_DURATIONS);
export const requestedDateSchema = z.iso
  .date()
  .refine((value) => !value.startsWith("0000-"), "Invalid date");
export const requestedDaySchema = z
  .object({
    date: requestedDateSchema,
    startsAt: z.iso.datetime({ offset: true }).nullable(),
    endsAt: z.iso.datetime({ offset: true }).nullable(),
    eventDayId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (value) => (value.startsAt === null) === (value.endsAt === null),
    "Start and end are required together",
  );
export const requestedDaysSchema = z.array(requestedDaySchema).min(1);
export const requestedDayResponseSchema = requestedDaySchema.safeExtend({
  operationalSchedule: z
    .object({
      id: z.string().uuid(),
      day: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      timeZone: z.string(),
      status: z.string(),
    })
    .nullable(),
});
export const durationModeSchema = z.enum(["one_day", "multi_day"]);
export const createSchema = z
  .object({
    packageId: z.string().uuid(),
    packageUpdatedAt: z.string().datetime().optional(),
    eventType: text(MAX_EVENT_TYPE_LENGTH),
    durationMode: durationModeSchema,
    requestedDays: z
      .array(z.object({ date: requestedDateSchema }).strict())
      .min(1),
    timeZone: text(MAX_TIME_ZONE_LENGTH).refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Invalid time zone"),
    guestCount: z
      .number()
      .int()
      .positive()
      .max(2147483647)
      .nullable()
      .optional(),
    contactName: text(MAX_CONTACT_NAME_LENGTH),
    phoneNumber: text(MAX_PHONE_NUMBER_LENGTH),
    specialRequests: z
      .string()
      .trim()
      .max(MAX_SPECIAL_REQUESTS_LENGTH)
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.durationMode === "one_day" && value.requestedDays.length !== 1) ||
      (value.durationMode === "multi_day" && value.requestedDays.length < 2)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Choose one date for 1 day or at least two for Multi-day",
        path: ["requestedDays"],
      });
    }
    const dates = new Set<string>();
    value.requestedDays.forEach((day, index) => {
      if (dates.has(day.date))
        ctx.addIssue({
          code: "custom",
          message: "Choose distinct dates",
          path: ["requestedDays", index, "date"],
        });
      dates.add(day.date);
    });
  });
export const saveRequestedDayTimesSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const requestedDayParams = z.object({
  id: z.string().uuid(),
  date: requestedDateSchema,
});
export type RequestedDay = z.infer<typeof requestedDaySchema>;
export type SaveRequestedDayTimesInput = z.infer<
  typeof saveRequestedDayTimesSchema
>;
export const updateStatusSchema = z
  .object({
    status: statusSchema,
    reason: z
      .string()
      .trim()
      .max(MAX_BOOKING_REASON_LENGTH)
      .nullable()
      .optional()
      .describe("Required for needs_details, declined, and cancelled"),
  })
  .refine(
    (value) =>
      !["needs_details", "declined", "cancelled"].includes(value.status) ||
      Boolean(value.reason),
    { message: "A reason is required for this status", path: ["reason"] },
  );
export const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "A cancellation reason is required")
    .max(MAX_BOOKING_REASON_LENGTH),
});
export const idParams = z.object({ id: z.string().uuid() });
export const bookingSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  customerId: z.string().uuid(),
  packageId: z.string().uuid(),
  packagePrice: priceSchema,
  packageMaxGuests: z.number().int().positive(),
  packageName: z.string(),
  eventType: z.string(),
  preferredDate: z.string(),
  estimatedDuration: estimatedDurationSchema,
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  timeZone: z.string(),
  guestCount: z.number().nullable(),
  estimatedDurationDays: z.number().int().min(8).nullable(),
  requestedDays: z.array(requestedDayResponseSchema).min(1).nullable(),
  durationMode: durationModeSchema.nullable(),
  requestedDayCount: z.number().int().positive().nullable(),
  contactName: z.string(),
  phoneNumber: z.string(),
  preferredVenueLocation: z.string().nullable(),
  specialRequests: z.string().nullable(),
  status: statusSchema,
  outOfRange: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CreateInput = z.infer<typeof createSchema>;
export type Status = z.infer<typeof statusSchema>;
