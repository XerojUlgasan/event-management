import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { publicSchema } from "./schemas.js";
import { json, errors } from "../packages/http.js";
import { listPublicServicesPageService } from "../../services/services/list-public-services-page.js";

export const listPublicServicesRoute = createRoute({
  method: "get",
  path: "/services",
  tags: ["Services"],
  request: { query: paginationQuerySchema },
  responses: {
    200: {
      content: json(
        z.object({
          services: z.array(publicSchema),
          nextCursor: z.string().nullable(),
        }),
      ),
      description: "Public services",
    },
    ...errors,
  },
});
export const listPublicServicesRouteHandler: AppRouteHandler<
  typeof listPublicServicesRoute
> = async (c) =>
  c.json(
    await listPublicServicesPageService(c.get("db"), c.req.valid("query")),
    200,
  );
