import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { getCatalogKnowledgeService } from "../../services/ai/get-catalog-knowledge.js";
import {
  kindSchema,
  listingSchema,
  chunkSchema,
  errors,
  response,
} from "./schemas.js";
export const detailRoute = createRoute({
  method: "get",
  path: "/admin/ai/knowledge/{kind}/{id}",
  tags: ["AI knowledge"],
  request: {
    params: z.object({ kind: kindSchema, id: z.uuid() }),
    query: paginationQuerySchema,
  },
  responses: {
    200: response(
      z.object({
        listing: listingSchema,
        chunks: z.array(chunkSchema),
        nextCursor: z.string().nullable(),
      }),
    ),
    404: { description: "Listing not found" },
    ...errors,
  },
});
export const detailRouteHandler: AppRouteHandler<typeof detailRoute> = async (
  c,
) => {
  const result = await getCatalogKnowledgeService(
    c.get("db"),
    c.req.valid("param"),
    c.req.valid("query"),
  );
  return result
    ? c.json(result, 200)
    : c.json({ error: "Listing not found" }, 404);
};
