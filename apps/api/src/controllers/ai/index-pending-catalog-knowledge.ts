import { createRoute, z } from "@hono/zod-openapi";
import { MAX_CURSOR_LENGTH } from "@event-management/contracts/pagination";
import { HTTPException } from "hono/http-exception";
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
      content: openapiJson(
        z.strictObject({
          cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).optional(),
        }),
      ),
    },
  },
  responses: {
    200: response(
      z.object({
        embedded: z.number().int(),
        unchanged: z.number().int(),
        superseded: z.number().int(),
        failed: z.number().int(),
        nextCursor: z.string().nullable(),
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
      await indexPendingCatalogKnowledgeService(
        c.get("db"),
        c.req.valid("json").cursor,
        signal,
      ),
      200,
    );
  } catch (error) {
    if (error instanceof HTTPException && error.status === 400) throw error;

    return jsonError(c, "Knowledge indexing is temporarily unavailable", 503);
  }
};
