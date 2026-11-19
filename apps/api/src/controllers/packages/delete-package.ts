import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, body } from "./http.js";
import { deletePackageService } from "../../services/packages/delete-package.js";

export const deletePackageRoute = createRoute({
  method: "delete",
  path: "/admin/packages/{id}",
  tags: ["Packages"],
  request: { params: idParams },
  responses: { 204: { description: "Deleted" }, ...errors },
});

export const deletePackageRouteHandler: AppRouteHandler<
  typeof deletePackageRoute
> = async (c) => {
  const outcome = await deletePackageService(
    c.get("db"),
    c.req.valid("param").id,
  );

  if (outcome) return jsonError(c, outcome.message, outcome.status);

  return c.body(null, 204);
};
