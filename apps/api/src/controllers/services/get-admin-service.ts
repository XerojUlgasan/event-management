import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { getAdminServiceService } from "../../services/services/get-admin-service.js";

export const getAdminServiceRoute = createRoute({
  method: "get",
  path: "/admin/services/{id}",
  tags: ["Services"],
  request: { params: idParams },
  responses: {
    200: { content: json(adminSchema), description: "Service catalog" },
    ...errors,
  },
});

export const getAdminServiceRouteHandler: AppRouteHandler<
  typeof getAdminServiceRoute
> = async (c) => {
  const value = await getAdminServiceService(
    c.get("db"),
    c.req.valid("param").id,
  );

  if ("status" in value) return jsonError(c, value.message, value.status);

  return c.json(value, 200);
};
