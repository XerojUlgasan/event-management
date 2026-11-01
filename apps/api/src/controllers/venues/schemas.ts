import { MAX_VENUE_PHOTOS } from "@event-management/contracts/limits/venues";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { z } from "@hono/zod-openapi";
export const venueIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const text = z.string().max(MAX_CATALOG_TEXT_LENGTH);
export const contentSchema = z.object({
  name: z.string().max(200), location: z.string().max(200), description: text,
  categories: z.array(z.string().trim().min(1).max(200)).max(50).refine(values => new Set(values.map(v => v.toLowerCase())).size === values.length, "Categories must be unique"),
  capacityMax: z.number().int().positive().max(2147483647).nullable(),
  imageUrls: z.array(z.url().startsWith("https://").max(2048)).max(MAX_VENUE_PHOTOS).refine(values => new Set(values.map(v => v.toLowerCase())).size === values.length, "Photos must be unique"),
});
export type VenueContent = z.infer<typeof contentSchema>;
export const versionSchema = contentSchema.extend({ id: venueIdSchema, venueId: venueIdSchema, version: z.number().int(), state: z.enum(["draft", "published", "superseded"]), updatedAt: z.string(), publishedAt: z.string().nullable() });
export const adminSchema = z.object({ id: venueIdSchema, archivedAt: z.string().nullable(), draft: versionSchema.nullable(), published: versionSchema.nullable(), versions: z.array(versionSchema) });
export const publicSchema = contentSchema.extend({ id: venueIdSchema, versionId: venueIdSchema, version: z.number().int(), publishedAt: z.string(), createdAt: z.string(), updatedAt: z.string(), archivedAt: z.null() });
export const errorSchema = z.object({ error: z.string() });
