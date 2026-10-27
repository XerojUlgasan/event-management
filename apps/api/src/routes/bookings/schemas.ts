import { z } from "@hono/zod-openapi";
import { errorSchema } from "../../lib/api-helpers.js";

export { errorSchema };

// ── Status constants & transition rules ─────────────────────────────────────

export const BOOKING_STATUSES = [
  "under_review",
  "quotation_sent",
  "awaiting_confirmation",
  "confirmed",
  "in_preparation",
  "completed",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Only these forward/lateral moves are allowed; backwards are blocked. */
export const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  under_review:           ["quotation_sent", "cancelled"],
  quotation_sent:         ["awaiting_confirmation", "under_review", "cancelled"],
  awaiting_confirmation:  ["confirmed", "quotation_sent", "cancelled"],
  confirmed:              ["in_preparation", "cancelled"],
  in_preparation:         ["completed", "cancelled"],
  completed:              [],
  cancelled:              [],
};

// ── Request schemas ──────────────────────────────────────────────────────────

export const createBookingSchema = z.object({
  customerId:   z.string().uuid(),
  eventName:    z.string().min(1).max(200),
  eventDate:    z.string().datetime(),
  guestCount:   z.number().int().min(1).max(500),
  specialNotes: z.string().max(2000).optional(),
  coordinator:  z.string().max(100).optional(),
  packageId:    z.string().uuid().optional(),
});

export const updateBookingSchema = z.object({
  eventName:    z.string().min(1).max(200).optional(),
  eventDate:    z.string().datetime().optional(),
  guestCount:   z.number().int().min(1).max(500).optional(),
  specialNotes: z.string().max(2000).nullable().optional(),
  coordinator:  z.string().max(100).optional(),
  packageId:    z.string().uuid().nullable().optional(),
  totalPriceMinor:     z.number().int().min(0).optional(),
  reservationFeeMinor: z.number().int().min(0).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
});

export const recordPaymentSchema = z.object({
  amountMinor:      z.number().int().positive(),
  paymentReference: z.string().max(200).optional(),
});

// ── Response schemas ─────────────────────────────────────────────────────────

export const bookingSchema = z.object({
  id:                   z.string().uuid(),
  customerId:           z.string().uuid(),
  customerName:         z.string().nullable(),
  customerEmail:        z.string(),
  status:               z.enum(BOOKING_STATUSES),
  eventName:            z.string(),
  eventDate:            z.string(),
  guestCount:           z.number().int(),
  specialNotes:         z.string().nullable(),
  coordinator:          z.string(),
  packageId:            z.string().uuid().nullable(),
  totalPriceMinor:      z.number().int(),
  reservationFeeMinor:  z.number().int(),
  paidAmountMinor:      z.number().int(),
  paymentStatus:        z.string(),
  paymentReference:     z.string().nullable(),
  paidAt:               z.string().nullable(),
  createdAt:            z.string(),
  updatedAt:            z.string(),
});

export const bookingListSchema = z.object({
  bookings: z.array(bookingSchema),
});
