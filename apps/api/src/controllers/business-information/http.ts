import { z } from "@hono/zod-openapi";
import { openapiJson as json } from "../../utils/openapi.js";

export { json };

const errorSchema = z.object({ error: z.string() });

export const errors = {
  400: {
    content: json(errorSchema),
    description: "Invalid business information",
  },
  401: { content: json(errorSchema), description: "Not signed in" },
  403: { content: json(errorSchema), description: "Admin access required" },
  409: {
    content: json(errorSchema),
    description: "Business information state conflict",
  },
};

export const body = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: json(schema),
});
