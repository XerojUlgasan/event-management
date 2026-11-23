import { createRoute, z } from "@hono/zod-openapi";
import { MAX_CATALOG_SEARCH_LENGTH } from "@event-management/contracts/limits/catalog";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { adminSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { listAdminPackagesPageService } from "../../services/packages/list-admin-packages-page.js";

export const listAdminPackagesRoute = createRoute({
  method: "get",
  path: "/admin/packages",
  tags: ["Packages"],
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
          packages: z.array(adminSchema),
          nextCursor: z.string().nullable(),
          counts: z.object({
            active: z.number().int(),
            archived: z.number().int(),
            filtered: z.number().int(),
          }),
        }),
      ),
      description: "Admin packages",
    },
    ...errors,
  },
});

export const listAdminPackagesRouteHandler: AppRouteHandler<
  typeof listAdminPackagesRoute
> = async (c) =>
  c.json(
    await listAdminPackagesPageService(c.get("db"), c.req.valid("query")),
    200,
  );
