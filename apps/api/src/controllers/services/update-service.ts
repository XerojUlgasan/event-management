import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { serviceEditSchema, adminSchema } from "./schemas.js";
import { updateServiceService } from "../../services/services/update-service.js";

export const updateServiceRoute = createRoute({
  method: "patch",
  path: "/admin/services/{id}",
  tags: ["Services"],
  request: {
    params: idParams,
    body: body(serviceEditSchema),
  },
  responses: {
    200: { content: json(adminSchema), description: "Service catalog" },
    ...errors,
  },
});

export const updateServiceRouteHandler: AppRouteHandler<
  typeof updateServiceRoute
> = async (c) => {
  const value = await updateServiceService(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
    c.get("session").user.id,
  );

  if ("status" in value) return jsonError(c, value.message, value.status);

  return c.json(value, 200);
};
