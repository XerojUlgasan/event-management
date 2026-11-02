import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { serviceEditSchema, adminSchema } from "./schemas.js";
import { editServiceDraftService } from "../../services/services/edit-service-draft.js";
export const editServiceDraftRoute = createRoute({
  method: "patch",
  path: "/admin/services/{id}/draft",
  tags: ["Services"],
  request: {
    params: idParams,
    body: body(
      serviceEditSchema,
    ),
  },
  responses: {
    200: { content: json(adminSchema), description: "Service catalog" },
    ...errors,
  },
});
export const editServiceDraftRouteHandler: AppRouteHandler<
  typeof editServiceDraftRoute
> = async (c) => {
  const value = await editServiceDraftService(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  );
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 200);
};
