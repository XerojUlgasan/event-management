import { createRoute, z } from "@hono/zod-openapi";
import { MAX_CATALOG_SEARCH_LENGTH } from "@event-management/contracts/limits/catalog";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { adminSchema } from "./schemas.js";
import { json, errors } from "../packages/http.js";
import { listAdminServicesPageService } from "../../services/services/list-admin-services-page.js";

export const listAdminServicesRoute = createRoute({
  method: "get",
  path: "/admin/services",
  tags: ["Services"],
  request: {
    query: paginationQuerySchema.extend({
      search: z.string().trim().max(MAX_CATALOG_SEARCH_LENGTH).optional(),
      archived: z.enum(["all", "active", "archived"]).default("all"),
    }),
  },
  responses: {
    200: {
      content: json(
        z.object({
          services: z.array(adminSchema),
          nextCursor: z.string().nullable(),
          counts: z.object({
            active: z.number().int(),
            archived: z.number().int(),
            filtered: z.number().int(),
          }),
        }),
      ),
      description: "Admin services",
    },
    ...errors,
  },
});

export const listAdminServicesRouteHandler: AppRouteHandler<
  typeof listAdminServicesRoute
> = async (c) =>
  c.json(
    await listAdminServicesPageService(c.get("db"), c.req.valid("query")),
    200,
  );
