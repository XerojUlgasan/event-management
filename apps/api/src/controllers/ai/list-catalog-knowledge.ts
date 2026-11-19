import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { listCatalogKnowledgeService } from "../../services/ai/list-catalog-knowledge.js";
import {
  kindSchema,
  statusSchema,
  listingSchema,
  summarySchema,
  errors,
  response,
} from "./schemas.js";

export const listRoute = createRoute({
  method: "get",
  path: "/admin/ai/knowledge",
  tags: ["AI knowledge"],
  request: {
    query: paginationQuerySchema.extend({
      search: z.string().trim().max(200).optional(),
      kind: kindSchema.optional(),
      status: z.union([statusSchema, z.literal("attention")]).optional(),
    }),
  },
  responses: {
    200: response(
      z.object({
        summary: summarySchema,
        listings: z.array(listingSchema),
        filteredCount: z.number().int(),
        nextCursor: z.string().nullable(),
        checkedAt: z.string(),
      }),
    ),
    ...errors,
  },
});

export const listRouteHandler: AppRouteHandler<typeof listRoute> = async (c) =>
  c.json(
    await listCatalogKnowledgeService(c.get("db"), c.req.valid("query")),
    200,
  );
