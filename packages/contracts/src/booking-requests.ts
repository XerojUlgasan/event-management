import { z } from "zod";

export const bookingStatusSchema = z.enum([
  "under_review",
  "needs_details",
  "accepted",
  "finished",
  "declined",
  "cancelled",
]);

export type BookingStatus = z.infer<typeof bookingStatusSchema>;
