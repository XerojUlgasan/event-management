import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { deleteServiceService } from "../../services/services/delete-service.js";

export const deleteServiceRoute = createRoute({
  method: "delete",
  path: "/admin/services/{id}",
  tags: ["Services"],
  request: { params: idParams },
  responses: { 204: { description: "Deleted" }, ...errors },
});

export const deleteServiceRouteHandler: AppRouteHandler<
  typeof deleteServiceRoute
> = async (c) => {
  const value = await deleteServiceService(
    c.get("db"),
    c.req.valid("param").id,
  );

  if (value) return jsonError(c, value.message, value.status);

  return c.body(null, 204);
};
