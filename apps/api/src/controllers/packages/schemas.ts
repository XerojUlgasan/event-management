import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { versionSchema as serviceVersionSchema } from "../services/schemas.js";
import { z } from "@hono/zod-openapi";

const text = z.string().max(MAX_CATALOG_TEXT_LENGTH);
export const priceSchema = z.object({
  kind: z.literal("fixed"),
  currency: z.literal("PHP"),
  amountMinor: z.number().int().positive().max(2147483647),
});
const packagePriceSchema = priceSchema.refine(price => price.amountMinor % 100 === 0, "Package price must be a whole peso amount");
export const assignmentInputSchema = z.object({ serviceVersionId: z.string().uuid(), role: z.enum(["included", "add_on"]), includedQuantity: z.number().int().positive().max(2147483647).nullable(), addOnPrice: priceSchema.nullable(), addOnMaxQuantity: z.number().int().positive().max(2147483647).nullable() }).refine(v => v.role === "included" ? v.includedQuantity !== null && v.addOnPrice === null && v.addOnMaxQuantity === null : v.includedQuantity === null && v.addOnPrice !== null && v.addOnMaxQuantity !== null, "Invalid service assignment for role");
export const assignmentSchema = z.object({ id: z.string().uuid(), serviceVersionId: z.string().uuid(), role: z.enum(["included", "add_on"]), includedQuantity: z.number().int().nullable(), addOnPrice: priceSchema.nullable(), addOnMaxQuantity: z.number().int().nullable(), service: serviceVersionSchema });
export const contentSchema = z.object({
  services: z.array(assignmentInputSchema).max(100).optional(),
  name: text,
  eventTypes: z.array(text).max(50),
  description: text,
  guestMax: z.number().int().positive().max(2147483647),
  inclusions: z.array(text).max(100),
  exclusions: z.array(text).max(100),
  imageUrl: z.url().startsWith("https://").max(2048).nullable(),
  price: packagePriceSchema.nullable(),
});
export type Content = z.infer<typeof contentSchema>;
export const versionSchema = contentSchema.extend({
  services: z.array(assignmentSchema),
  id: z.string().uuid(), packageId: z.string().uuid(), version: z.number().int(),
  state: z.enum(["draft", "published", "superseded"]),
  updatedAt: z.string(), publishedAt: z.string().nullable(),
});
export const publicSchema = contentSchema.extend({
  services: z.array(assignmentSchema),
  id: z.string().uuid(), versionId: z.string().uuid(), version: z.number().int(), publishedAt: z.string(),
});
export const adminSchema = z.object({
  id: z.string().uuid(), archivedAt: z.string().nullable(),
  draft: versionSchema.nullable(), published: versionSchema.nullable(), versions: z.array(versionSchema),
});
export const errorSchema = z.object({ error: z.string() });
