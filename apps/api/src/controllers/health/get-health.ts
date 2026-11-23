import { createRoute, z } from "@hono/zod-openapi";
import { openapiJson } from "../../utils/openapi.js";
import type { AppRouteHandler } from "../../types/hono.js";

const healthResponseSchema = z.object({ status: z.literal("ok") });

export const getHealthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Check API availability",
  responses: {
    200: {
      content: openapiJson(healthResponseSchema),
      description: "API is available",
    },
  },
});

export const getHealthRouteHandler: AppRouteHandler<
  typeof getHealthRoute
> = async (c) => {
  return c.json({ status: "ok" }, 200);
};
