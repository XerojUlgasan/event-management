import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { serviceInputSchema, adminSchema } from "./schemas.js";
import { createServiceService } from "../../services/services/create-service.js";
export const createServiceRoute = createRoute({
  method: "post",
  path: "/admin/services",
  tags: ["Services"],
  request: { body: body(serviceInputSchema) },
  responses: {
    201: { content: json(adminSchema), description: "Service catalog" },
    ...errors,
  },
});
export const createServiceRouteHandler: AppRouteHandler<
  typeof createServiceRoute
> = async (c) => {
  const value = await createServiceService(
    c.get("db"),
    c.req.valid("json"),
    c.get("session").user.id,
  );
  if ("status" in value) return jsonError(c, value.message, value.status);
  return c.json(value, 201);
};
