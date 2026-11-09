import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { publicSchema } from "./schemas.js";
import { json, errors, slugParams } from "./http.js";
import { getPublicPackageBySlugService } from "../../services/packages/get-public-package-by-slug.js";

export const getPublicPackageBySlugRoute = createRoute({
  method: "get",
  path: "/packages/slug/{slug}",
  tags: ["Packages"],
  request: { params: slugParams },
  responses: {
    200: { content: json(publicSchema), description: "Published package" },
    ...errors,
  },
});

export const getPublicPackageBySlugRouteHandler: AppRouteHandler<typeof getPublicPackageBySlugRoute> = async (c) => {
  const row = await getPublicPackageBySlugService(c.get("db"), c.req.valid("param").slug);
  return row ? c.json(row, 200) : c.json({ error: "Package not found" }, 404);
};
