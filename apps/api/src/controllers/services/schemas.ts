import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { z } from "@hono/zod-openapi";
const text = z.string().max(MAX_CATALOG_TEXT_LENGTH);
export const contentSchema = z.object({
  name: text,
  categories: z.array(text).max(50),
  description: text,
  imageUrl: z.string().max(2048).refine(value => {
    if (/^\/v1\/service-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true;
    if (!/^https:\/\//i.test(value) || !z.url().safeParse(value).success) return false;
    try { return !/^\/v1\/service-images(?:\/|$)/i.test(decodeURIComponent(new URL(value).pathname)); } catch { return false; }
  }, "Must be an HTTPS URL or uploaded service image path").nullable(),
});
export type ServiceContent = z.infer<typeof contentSchema>;
export const versionSchema = contentSchema.extend({ id: z.string().uuid(), serviceId: z.string().uuid(), version: z.number().int(), state: z.enum(["draft", "published", "superseded"]), updatedAt: z.string(), publishedAt: z.string().nullable() });
export const adminSchema = z.object({ id: z.string().uuid(), archivedAt: z.string().nullable(), draft: versionSchema.nullable(), published: versionSchema.nullable(), versions: z.array(versionSchema) });
export const publicSchema = contentSchema.extend({ id: z.string().uuid(), versionId: z.string().uuid(), version: z.number().int(), publishedAt: z.string() });
