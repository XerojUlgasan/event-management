import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { adminSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { listAdminVenuesPageService } from "../../services/venues/list-admin-venues-page.js";

export const listAdminVenuesRoute = createRoute({
  method: "get",
  path: "/admin/venues",
  tags: ["Venues"],
  request: {
    query: paginationQuerySchema.extend({
      search: z.string().trim().max(200).optional(),
      archived: z.enum(["all", "active", "archived"]).default("all"),
    }),
  },
  responses: {
    200: {
      content: json(
        z.object({
          venues: z.array(adminSchema),
          nextCursor: z.string().nullable(),
          counts: z.object({
            active: z.number().int(),
            archived: z.number().int(),
            filtered: z.number().int(),
          }),
        }),
      ),
      description: "Admin venues",
    },
    ...errors,
  },
});
export const listAdminVenuesRouteHandler: AppRouteHandler<
  typeof listAdminVenuesRoute
> = async (c) =>
  c.json(
    await listAdminVenuesPageService(c.get("db"), c.req.valid("query")),
    200,
  );
