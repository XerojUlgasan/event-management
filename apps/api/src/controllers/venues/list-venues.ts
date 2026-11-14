import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { publicSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { listPublicVenuesPageService } from "../../services/venues/list-public-venues-page.js";

export const listVenuesRoute = createRoute({
  method: "get",
  path: "/venues",
  tags: ["Venues"],
  request: { query: paginationQuerySchema },
  responses: {
    200: {
      content: json(
        z.object({
          venues: z.array(publicSchema),
          nextCursor: z.string().nullable(),
        }),
      ),
      description: "Public venues",
    },
    ...errors,
  },
});
export const listVenuesRouteHandler: AppRouteHandler<
  typeof listVenuesRoute
> = async (c) =>
  c.json(
    await listPublicVenuesPageService(c.get("db"), c.req.valid("query")),
    200,
  );
