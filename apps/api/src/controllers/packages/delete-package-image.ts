import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, body } from "./http.js";
import { deletePackageImageService } from "../../services/packages/delete-package-image.js";

export const deletePackageImageRoute = createRoute({ method: "delete", path: "/admin/package-images/{id}", tags: ["Packages"], request: { params: idParams }, responses: {
  204: { description: "Unreferenced image deleted" }, ...errors,
} });
export const deletePackageImageRouteHandler: AppRouteHandler<typeof deletePackageImageRoute> = async c => {
  const id = c.req.valid("param").id.toLowerCase();
  const outcome = await deletePackageImageService(c.get("db"), id);
  if (outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.body(null, 204);
};
