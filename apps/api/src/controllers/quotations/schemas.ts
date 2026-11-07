import { z } from "@hono/zod-openapi";
import { MAX_BOOKING_REASON_LENGTH, MAX_QUOTATION_DESCRIPTION_LENGTH } from "@event-management/contracts/limits/booking-requests";

export const quotationStatusSchema = z.enum(["draft", "sent", "accepted", "superseded"]);
export const quotationDirectionSchema = z.enum(["add", "deduct"]);
export const quotationKindSchema = z.enum(["addition", "deduction", "substitution", "adjustment"]);
export const quotationItemInputSchema = z.object({
  direction: quotationDirectionSchema,
  kind: quotationKindSchema,
  description: z.string().trim().min(1).max(MAX_QUOTATION_DESCRIPTION_LENGTH),
  amountMinor: z.number().int().positive().max(2147483647),
  serviceId: z.string().uuid().nullable().optional(),
  customizationRequestId: z.string().uuid().nullable().optional(),
}).strict();
export const quotationItemSchema = quotationItemInputSchema.extend({
  id: z.string().uuid(),
  sortOrder: z.number().int().nonnegative(),
});
export const quotationSchema = z.object({
  id: z.string().uuid(),
  bookingRequestId: z.string().uuid(),
  version: z.number().int().positive(),
  currency: z.literal("PHP"),
  baseAmountMinor: z.number().int().positive(),
  totalAmountMinor: z.number().int().nonnegative(),
  status: quotationStatusSchema,
  createdBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sentAt: z.string().nullable(),
  acceptedAt: z.string().nullable(),
  supersededAt: z.string().nullable(),
  items: z.array(quotationItemSchema),
});
export const quotationIdParams = z.object({ id: z.string().uuid() });
export const bookingIdParams = z.object({ id: z.string().uuid() });
export const quotationItemsBody = z.object({ items: z.array(quotationItemInputSchema).max(100), expectedUpdatedAt: z.string().datetime().optional() }).strict();
export const revisionBody = z.object({ reason: z.string().trim().min(1).max(MAX_BOOKING_REASON_LENGTH) }).strict();
export type QuotationItemInput = z.infer<typeof quotationItemInputSchema>;
export type QuotationItem = z.infer<typeof quotationItemSchema>;
export type Quotation = z.infer<typeof quotationSchema>;
export type QuotationStatus = z.infer<typeof quotationStatusSchema>;
