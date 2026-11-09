import { z } from "@hono/zod-openapi";
import { venueIdSchema, errorSchema } from "./schemas.js";
export const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
export const body = <T extends z.ZodType>(schema: T) => ({ required: true as const, content: json(schema) });
export const idParams = z.object({ id: venueIdSchema });
export const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });
export const errors = { 400: {content: json(errorSchema), description: "Invalid venue data"}, 401: {content: json(errorSchema), description: "Sign in required"}, 403: {content: json(errorSchema), description: "Administrator access required"}, 404: {content: json(errorSchema), description: "Venue not found"}, 409: {content: json(errorSchema), description: "Venue conflict"} };
