import { z } from "@hono/zod-openapi";

export const contentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
});

export const venueIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const venueSchema = contentSchema.extend({
  id: venueIdSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});

export const errorSchema = z.object({ error: z.string() });

export type Content = z.infer<typeof contentSchema>;
