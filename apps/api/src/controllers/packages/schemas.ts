import {
  sectionSchema,
  sectionsSchema,
} from "@event-management/contracts/catalog-canvas";
export {
  mediaSchema,
  widgetSchema,
  sectionSchema,
  sectionsSchema,
} from "@event-management/contracts/catalog-canvas";
import { z } from "@hono/zod-openapi";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";

const text = z.string().trim().max(MAX_CATALOG_TEXT_LENGTH);
export const priceSchema = z.object({
  kind: z.literal("fixed"),
  currency: z.literal("PHP"),
  amountMinor: z.number().int().positive().max(2147483647),
});
const packagePriceSchema = priceSchema.refine(
  (price) => price.amountMinor % 100 === 0,
  "Package price must be a whole peso amount",
);
export const contentSchema = z
  .object({
    name: text.min(1),
    description: text.optional(),
    maxGuests: z.number().int().positive().max(2147483647),
    price: packagePriceSchema,
    sections: sectionsSchema,
    thumbnailMediaId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type Content = z.infer<typeof contentSchema>;
// imageUrl contains only the dedicated thumbnail; null uses the UI default.
export const publicSchema = z.object({
  name: z.string(),
  maxGuests: z.number(),
  price: priceSchema,
  sections: z.array(sectionSchema),
  id: z.string().uuid(),
  slug: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  packageType: z.enum(["catalog", "custom"]),
  customForBookingRequestId: z.string().uuid().nullable(),
});
export const adminSchema = publicSchema;
export const errorSchema = z.object({ error: z.string() });
