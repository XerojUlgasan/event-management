import { z } from "@hono/zod-openapi";

export const idParams = z.object({ id: z.string().uuid() });
