import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, body } from "../packages/http.js";
import { deleteServiceImageService } from "../../services/services/delete-service-image.js";

export const deleteServiceImageRoute = createRoute({ method: "delete", path: "/admin/service-images/{id}", tags: ["Services"], request: { params: idParams }, responses: {
  204: { description: "Unreferenced image deleted" }, ...errors,
} });
export const deleteServiceImageRouteHandler: AppRouteHandler<typeof deleteServiceImageRoute> = async c => {
  const id = c.req.valid("param").id.toLowerCase();
  const outcome = await deleteServiceImageService(c.get("db"), id);
  if (outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.body(null, 204);
};
