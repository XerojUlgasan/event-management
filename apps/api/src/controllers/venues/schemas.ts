import { z } from "@hono/zod-openapi";

export const contentSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
});

export const venueSchema = contentSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});

export const errorSchema = z.object({ error: z.string() });

export type Content = z.infer<typeof contentSchema>;
