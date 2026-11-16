import { sectionsSchema } from "../packages/schemas.js";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { z } from "@hono/zod-openapi";
const text = z.string().trim().min(1).max(MAX_CATALOG_TEXT_LENGTH);
export const contentSchema = z.object({
  name: text,
  hourlyRatePesos: z.number().int().positive().max(2147483647),
  fixedPricePesos: z.number().int().positive().max(2147483647).nullable(),
  includedHours: z.number().int().positive().max(2147483647).nullable(),
  description: text,
  sections: sectionsSchema.optional(),
});
export type ServiceContent = z.infer<typeof contentSchema>;
const validPricing = (value: {
  fixedPricePesos: number | null;
  includedHours: number | null;
}) => (value.fixedPricePesos === null) === (value.includedHours === null);
export const serviceInputSchema = contentSchema.strict().refine(validPricing, {
  message: "Fixed price and included hours must be provided together",
});
export const serviceEditSchema = contentSchema
  .extend({ expectedUpdatedAt: z.string().datetime() })
  .strict()
  .refine(validPricing, {
    message: "Fixed price and included hours must be provided together",
  });
export const adminSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  hourlyRatePesos: z.number().int().nullable(),
  fixedPricePesos: z.number().int().nullable(),
  includedHours: z.number().int().nullable(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  sections: sectionsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
  publishedAt: z.string(),
});
export const publicSchema = adminSchema;
