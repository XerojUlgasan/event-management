import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { packageCatalogQuerySchema } from "../catalog/public-filters.js";
import { publicSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { listPublicPackagesPageService } from "../../services/packages/list-public-packages-page.js";

export const listPublicPackagesRoute = createRoute({
  method: "get",
  path: "/packages",
  tags: ["Packages"],
  request: { query: packageCatalogQuerySchema },
  responses: {
    200: {
      content: json(
        z.object({
          packages: z.array(publicSchema),
          nextCursor: z.string().nullable(),
        }),
      ),
      description: "Public packages",
    },
    ...errors,
  },
});

export const listPublicPackagesRouteHandler: AppRouteHandler<
  typeof listPublicPackagesRoute
> = async (c) =>
  c.json(
    await listPublicPackagesPageService(c.get("db"), c.req.valid("query")),
    200,
  );
