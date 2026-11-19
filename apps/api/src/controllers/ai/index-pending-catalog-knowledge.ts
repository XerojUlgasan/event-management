import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import { indexPendingCatalogKnowledgeService } from "../../services/ai/workflows/index-pending-catalog-knowledge.js";
import { errors, response } from "./schemas.js";

export const indexPendingRoute = createRoute({
  method: "post",
  path: "/admin/ai/knowledge/index",
  tags: ["AI knowledge"],
  request: {
    body: {
      required: true,
      content: openapiJson(z.strictObject({})),
    },
  },
  responses: {
    202: response(
      z.object({
        pendingListings: z.number().int().nonnegative(),
        submittedListings: z.number().int().nonnegative(),
        skippedListings: z.number().int().nonnegative(),
        failedListings: z.number().int().nonnegative(),
      }),
    ),
    503: { description: "Knowledge indexing is temporarily unavailable" },
    ...errors,
  },
});

export const indexPendingRouteHandler: AppRouteHandler<
  typeof indexPendingRoute
> = async (c) => {
  try {
    const signal = AbortSignal.any([
      c.req.raw.signal,
      AbortSignal.timeout(75_000),
    ]);

    return c.json(
      await indexPendingCatalogKnowledgeService(c.get("db"), signal),
      202,
    );
  } catch {
    return jsonError(c, "Knowledge indexing is temporarily unavailable", 503);
  }
};
