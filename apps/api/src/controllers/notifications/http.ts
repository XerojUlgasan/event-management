import { z } from "@hono/zod-openapi";
import { openapiJson as json } from "../../utils/openapi.js";

const error = z.object({ error: z.string() });

export { json };

export const errors = {
  400: { content: json(error), description: "Invalid request" },
  401: { content: json(error), description: "Sign in required" },
  404: { content: json(error), description: "Notification not found" },
};
