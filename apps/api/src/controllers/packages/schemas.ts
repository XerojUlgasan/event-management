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
import { MAX_PACKAGE_SERVICES } from "@event-management/contracts/catalog";
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
export const packageServicesSchema = z
  .array(
    z
      .object({
        serviceId: z.string().uuid(),
        role: z.enum(["included", "optional"]),
      })
      .strict(),
  )
  .max(MAX_PACKAGE_SERVICES)
  .superRefine((services, ctx) => {
    if (
      new Set(services.map((service) => service.serviceId)).size !==
      services.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Each service can only be added once",
      });
  });
export const contentSchema = z
  .object({
    name: text.min(1),
    description: text.optional(),
    maxGuests: z.number().int().positive().max(2147483647),
    price: packagePriceSchema,
    sections: sectionsSchema,
    services: packageServicesSchema.default([]),
    thumbnailMediaId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type Content = z.infer<typeof contentSchema>;
// Response schemas include the stored description and derived cover image.
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
  services: z.array(
    z.object({
      serviceId: z.string().uuid(),
      name: z.string(),
      role: z.enum(["included", "optional"]),
      sortOrder: z.number(),
      archivedAt: z.string().nullable(),
    }),
  ),
});
export const adminSchema = publicSchema;
export const errorSchema = z.object({ error: z.string() });
