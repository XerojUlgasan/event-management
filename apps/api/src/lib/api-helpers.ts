import { z } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "../types/hono.js";

/** Wraps a Zod schema as an OpenAPI JSON content block. */
export const json = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

/** Wraps a Zod schema as a required JSON request body. */
export const body = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: json(schema),
});

/** Standard error response schema used across all routes. */
export const errorSchema = z.object({ error: z.string() });

/** Shared 4xx OpenAPI response descriptors. Pass a `subject` to customise messages. */
export function commonErrors(subject: string) {
  return {
    400: { content: json(errorSchema), description: `Invalid ${subject} data` },
    401: { content: json(errorSchema), description: "Not signed in" },
    403: { content: json(errorSchema), description: "Admin access required" },
    404: { content: json(errorSchema), description: `${subject} not found` },
    409: { content: json(errorSchema), description: `${subject} state conflict` },
  };
}

/** Returns a typed error payload for inline transaction error returns. */
export const routeError = (message: string, status: 400 | 404 | 409) => ({
  message,
  status,
});

/** Route-level middleware that rejects non-admin sessions with 403. */
export const requireAdmin = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
});
