import { z } from "@hono/zod-openapi";
import { venueSchema, errorSchema } from "./schemas.js";

export const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
export const errors = {
  400: { content: json(errorSchema), description: "Invalid venue data" },
  401: { content: json(errorSchema), description: "Not signed in" },
  403: { content: json(errorSchema), description: "Admin access required" },
  404: { content: json(errorSchema), description: "Venue not found" },
  409: { content: json(errorSchema), description: "Venue state conflict" },
};
export const idParams = z.object({ id: z.string().min(1) });
export const body = <T extends z.ZodType>(schema: T) => ({ required: true as const, content: json(schema) });
export const result = { content: json(venueSchema), description: "Venue" };
