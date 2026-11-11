import {
  MAX_QUOTATION_AMOUNT_MINOR,
  MAX_QUOTATION_DESCRIPTION_LENGTH,
  MAX_QUOTATION_ITEMS,
  MAX_QUOTATION_REASON_LENGTH,
} from "@event-management/contracts/quotations";
import { z } from "@hono/zod-openapi";
export const idParams = z.object({ id: z.string().uuid() });
export const revision = z.string().min(1).max(100);
export const expectedBody = z.strictObject({ expectedUpdatedAt: revision });
export const itemSchema = z.strictObject({
  id: z.string().uuid(),
  direction: z.enum(["add", "deduct"]),
  kind: z.enum(["addition", "deduction", "substitution", "adjustment"]),
  description: z.string().trim().min(1).max(MAX_QUOTATION_DESCRIPTION_LENGTH),
  amountMinor: z.number().int().positive().max(MAX_QUOTATION_AMOUNT_MINOR),
  serviceId: z.string().uuid().nullable(),
});
export const saveBody = z.strictObject({
  expectedUpdatedAt: revision,
  items: z
    .array(itemSchema)
    .max(MAX_QUOTATION_ITEMS)
    .refine(
      (items) =>
        new Set(items.map((i) => i.id.toLowerCase())).size === items.length,
      "Item IDs must be unique",
    ),
});
export const reviseBody = expectedBody.extend({
  reason: z.string().trim().min(1).max(MAX_QUOTATION_REASON_LENGTH),
});
export const quotationSchema = z.object({
  id: z.string().uuid(),
  bookingRequestId: z.string().uuid(),
  version: z.number().int(),
  currency: z.literal("PHP"),
  baseAmountMinor: z.number().int(),
  totalAmountMinor: z.number().int(),
  status: z.enum(["draft", "sent", "accepted", "superseded"]),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sentAt: z.string().nullable(),
  acceptedAt: z.string().nullable(),
  supersededAt: z.string().nullable(),
  offeredPackageId: z.string().uuid().nullable(),
  adjustmentsReviewed: z.boolean(),
  previousQuotationId: z.string().uuid().nullable(),
  revisionReason: z.string().nullable(),
  items: z.array(itemSchema),
});
export type ItemInput = z.infer<typeof itemSchema>;
