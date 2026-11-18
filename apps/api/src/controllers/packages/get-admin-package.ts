import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, result } from "./http.js";
import { getAdminPackageService } from "../../services/packages/get-admin-package.js";

export const getAdminPackageRoute = createRoute({
  method: "get",
  path: "/admin/packages/{id}",
  tags: ["Packages"],
  request: { params: idParams },
  responses: { 200: result, ...errors },
});
export const getAdminPackageRouteHandler: AppRouteHandler<
  typeof getAdminPackageRoute
> = async (c) => {
  const row = await getAdminPackageService(
    c.get("db"),
    c.req.valid("param").id,
  );
  return row ? c.json(row, 200) : jsonError(c, "Package not found", 404);
};
