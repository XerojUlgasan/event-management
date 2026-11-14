import { z } from "@hono/zod-openapi";
import { errorSchema } from "./schemas.js";

export const json = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});
export const errors = {
  400: { content: json(errorSchema), description: "Invalid message" },
  401: { content: json(errorSchema), description: "Not signed in" },
  403: { content: json(errorSchema), description: "Wrong account role" },
  404: { content: json(errorSchema), description: "Conversation not found" },
  409: { content: json(errorSchema), description: "Conversation is closed" },
};
export const idParams = z.object({ id: z.string().uuid() });
export const body = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: json(schema),
});
