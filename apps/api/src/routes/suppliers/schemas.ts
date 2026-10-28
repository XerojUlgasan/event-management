import { z } from "@hono/zod-openapi";
export { errorSchema } from "../../lib/api-helpers.js";

// ── Request schemas ──────────────────────────────────────────────────────────

export const supplierQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
});

// ── Response schemas ─────────────────────────────────────────────────────────

export const supplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  contactNumber: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  isInternal: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const supplierListSchema = z.object({
  suppliers: z.array(supplierSchema),
});

export const availabilitySchema = z.object({
  available: z.boolean(),
  conflictingBookings: z.array(z.object({
    bookingId: z.string().uuid(),
    eventName: z.string(),
    eventDate: z.string(),
    eventStartTime: z.string(),
    eventEndTime: z.string(),
  })),
});
