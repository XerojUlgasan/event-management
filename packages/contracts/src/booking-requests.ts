import { z } from "zod";

export const bookingStatusSchema = z.enum([
  "under_review",
  "needs_details",
  "accepted",
  "declined",
  "cancelled",
]);

export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const eventCompletionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ready"), readyAt: z.iso.datetime() }),
  z.strictObject({
    status: z.literal("finished"),
    finishedAt: z.iso.datetime(),
  }),
]);

export type EventCompletion = z.infer<typeof eventCompletionSchema>;
