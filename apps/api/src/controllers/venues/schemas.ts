import { sectionsSchema } from "../packages/schemas.js";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { z } from "@hono/zod-openapi";
export const venueIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const contentSchema = z.object({ sections: sectionsSchema.optional(), name: z.string().trim().min(1).max(200), location: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(MAX_CATALOG_TEXT_LENGTH), maxGuests: z.number().int().positive().max(2147483647) }).strict();
export type VenueContent = z.infer<typeof contentSchema>;
export const adminSchema = z.object({ sections: sectionsSchema, id: venueIdSchema, name: z.string(), location: z.string(), description: z.string(), maxGuests: z.number().int().nullable(), publishedAt: z.string(), createdAt: z.string(), updatedAt: z.string(), archivedAt: z.string().nullable() });
export const publicSchema = adminSchema;
export const errorSchema = z.object({ error: z.string() });
