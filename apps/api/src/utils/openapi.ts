import type { z } from "@hono/zod-openapi";

export const openapiJson = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});
