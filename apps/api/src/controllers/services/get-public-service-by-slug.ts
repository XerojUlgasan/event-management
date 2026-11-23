import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, slugParams } from "../packages/http.js";
import { publicSchema } from "./schemas.js";
import { getPublicServiceBySlugService } from "../../services/services/get-public-service-by-slug.js";

export const getPublicServiceBySlugRoute = createRoute({
  method: "get",
  path: "/services/slug/{slug}",
  tags: ["Services"],
  request: { params: slugParams },
  responses: {
    200: { content: json(publicSchema), description: "Service catalog" },
    ...errors,
  },
});

export const getPublicServiceBySlugRouteHandler: AppRouteHandler<
  typeof getPublicServiceBySlugRoute
> = async (c) => {
  const value = await getPublicServiceBySlugService(
    c.get("db"),
    c.req.valid("param").slug,
  );

  return value
    ? c.json(value, 200)
    : jsonError(c, "Service not found", 404);
};
