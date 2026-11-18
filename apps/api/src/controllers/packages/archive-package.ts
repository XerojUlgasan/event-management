import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, result } from "./http.js";
import { archivePackageService } from "../../services/packages/archive-package.js";

export const archivePackageRoute = createRoute({
  method: "post",
  path: "/admin/packages/{id}/archive",
  tags: ["Packages"],
  request: { params: idParams },
  responses: { 200: result, ...errors },
});
export const archivePackageRouteHandler: AppRouteHandler<
  typeof archivePackageRoute
> = async (c) => {
  const outcome = await archivePackageService(
    c.get("db"),
    c.req.valid("param").id,
  );
  if ("status" in outcome)
    return jsonError(c, outcome.message, outcome.status);
  return c.json(outcome, 200);
};
