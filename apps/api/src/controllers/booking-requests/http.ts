import { z } from "@hono/zod-openapi";
import { openapiJson as json } from "../../utils/openapi.js";

const error = z.object({ error: z.string() });

export { json };

export const body = <T extends z.ZodType>(schema: T) => ({
  content: json(schema),
  required: true as const,
});

export const errors = {
  400: { content: json(error), description: "Invalid request" },
  401: { content: json(error), description: "Sign in required" },
  403: { content: json(error), description: "Forbidden" },
  404: { content: json(error), description: "Not found" },
  409: { content: json(error), description: "Conflict" },
};
