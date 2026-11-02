import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { z } from "@hono/zod-openapi";
const text = z.string().max(MAX_CATALOG_TEXT_LENGTH);
export const contentSchema = z.object({
  name: text,
  hourlyRatePesos: z.number().int().min(1).max(2147483647).nullable(),
  description: text,
  imageId: z.string().uuid().nullable(),
});
export type ServiceContent = z.infer<typeof contentSchema>;
export const serviceInputSchema = contentSchema
  .omit({ imageId: true })
  .strict();
export const serviceEditSchema = serviceInputSchema.extend({
  removeImage: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime(),
});
export const versionSchema = contentSchema.extend({
  id: z.string().uuid(),
  serviceId: z.string().uuid(),
  version: z.number().int(),
  state: z.enum(["draft", "published", "superseded"]),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
});
export const adminSchema = z.object({
  id: z.string().uuid(),
  archivedAt: z.string().nullable(),
  draft: versionSchema.nullable(),
  published: versionSchema.nullable(),
  versions: z.array(versionSchema),
});
export const publicSchema = contentSchema.extend({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
  version: z.number().int(),
  publishedAt: z.string(),
});
