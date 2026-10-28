import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { archiveServiceService } from "../../services/services/archive-service.js";
export const archiveServiceRoute = createRoute({
  method: "post",
  path: "/admin/services/{id}/archive",
  tags: ["Services"],
  request: { params: idParams },
  responses: {
    200: { content: json(adminSchema), description: "Service catalog" },
    ...errors,
  },
});
export const archiveServiceRouteHandler: AppRouteHandler<
  typeof archiveServiceRoute
> = async (c) => {
  const value = await archiveServiceService(
    c.get("db"),
    c.req.valid("param").id,
  );
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 200);
};
