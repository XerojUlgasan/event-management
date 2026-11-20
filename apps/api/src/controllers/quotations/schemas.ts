import {
  MAX_QUOTATION_AMOUNT_MINOR,
  MAX_QUOTATION_DESCRIPTION_LENGTH,
  MAX_QUOTATION_HOURS,
  MAX_QUOTATION_ITEMS,
  MAX_QUOTATION_REASON_LENGTH,
} from "@event-management/contracts/quotations";
import { z } from "@hono/zod-openapi";

export const idParams = z.object({ id: z.string().uuid() });

const revision = z.string().min(1).max(100);

const itemIdentity = {
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(MAX_QUOTATION_DESCRIPTION_LENGTH),
};

const quotationAmount = z.number().int().min(0).max(MAX_QUOTATION_AMOUNT_MINOR);

const manualItemSchema = z.strictObject({
  ...itemIdentity,
  direction: z.enum(["add", "deduct"]),
  kind: z.enum(["addition", "deduction", "substitution", "adjustment"]),
  amountMinor: quotationAmount.min(1),
  serviceId: z.string().uuid().nullable(),
});

const addonTermsSchema = z.strictObject({
  fixedPriceOverrideMinor: quotationAmount.nullable(),
  hourlyRateOverrideMinor: quotationAmount.nullable(),
  hours: z.number().int().min(0).max(MAX_QUOTATION_HOURS).nullable(),
});

const addonItemSchema = z.strictObject({
  ...itemIdentity,
  direction: z.literal("add"),
  kind: z.literal("addition"),
  amountMinor: quotationAmount.nullable(),
  serviceId: z.string().uuid(),
  addon: addonTermsSchema.extend({
    source: z.strictObject({
      packageId: z.string().uuid(),
      addonId: z.string().uuid(),
      fixedPriceMinor: z.number().int().positive().nullable(),
      includedHours: z
        .number()
        .int()
        .positive()
        .max(MAX_QUOTATION_HOURS)
        .nullable(),
      hourlyRateMinor: z.number().int().positive().nullable(),
    }),
    requiresRemoval: z.enum(["included", "archived"]).optional(),
  }),
});

export const itemSchema = z.union([
  manualItemSchema.extend({
    serviceId: manualItemSchema.shape.serviceId.default(null),
  }),
  addonItemSchema,
]);

const itemInputSchema = z.union([
  manualItemSchema.extend({ serviceId: z.null() }),
  z.strictObject({
    id: itemIdentity.id,
    addon: z.strictObject({ hours: addonTermsSchema.shape.hours.unwrap() }),
  }),
]);

const itemResponseSchema = z.union([
  manualItemSchema.extend({
    description: z.string(),
    amountMinor: quotationAmount,
  }),
  addonItemSchema,
]);

const sourceFields = {
  expectedBookingUpdatedAt: revision,
  packageId: z.string().uuid(),
  expectedPackageUpdatedAt: revision,
  currentOffer: z
    .strictObject({ id: z.string().uuid(), updatedAt: revision })
    .nullable(),
};

export const sendBody = z.strictObject({
  ...sourceFields,
  requestId: z.string().uuid(),
  revisionReason: z
    .string()
    .trim()
    .min(1)
    .max(MAX_QUOTATION_REASON_LENGTH)
    .nullable(),
  items: z
    .array(itemInputSchema)
    .max(MAX_QUOTATION_ITEMS)
    .refine(
      (items) =>
        new Set(items.map((i) => i.id.toLowerCase())).size === items.length,
      "Item IDs must be unique",
    ),
});

export const preparationSchema = z.object({
  ...sourceFields,
  bookingRequestId: z.string().uuid(),
  baseAmountMinor: quotationAmount,
  items: z.array(itemResponseSchema),
});

export const quotationSchema = z.object({
  id: z.string().uuid(),
  bookingRequestId: z.string().uuid(),
  version: z.number().int(),
  currency: z.literal("PHP"),
  baseAmountMinor: z.number().int(),
  totalAmountMinor: z.number().int(),
  status: z.enum(["draft", "sent", "superseded"]),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sentAt: z.string().nullable(),
  supersededAt: z.string().nullable(),
  offeredPackageId: z.string().uuid().nullable(),
  adjustmentsReviewed: z.boolean(),
  previousQuotationId: z.string().uuid().nullable(),
  revisionReason: z.string().nullable(),
  items: z.array(itemResponseSchema),
});
