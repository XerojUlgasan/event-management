import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { listPublicServicesService } from "../../services/services/list-public-services.js";
export const getPublicServiceRoute = createRoute({
  method: "get",
  path: "/services/{id}",
  tags: ["Services"],
  request: { params: idParams },
  responses: {
    200: { content: json(publicSchema), description: "Service catalog" },
    ...errors,
  },
});
export const getPublicServiceRouteHandler: AppRouteHandler<
  typeof getPublicServiceRoute
> = async (c) => {
  const value = await listPublicServicesService(
    c.get("db"),
    c.req.valid("param").id,
  );
  if (!value[0]) return jsonError(c, "Service not found", 404);
  return c.json(value[0], 200);
};
