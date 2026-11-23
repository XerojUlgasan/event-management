import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { contentSchema } from "./schemas.js";
import { body, errors, idParams, result } from "./http.js";
import { updatePackageService } from "../../services/packages/update-package.js";

export const updatePackageRoute = createRoute({
  method: "patch",
  path: "/admin/packages/{id}",
  tags: ["Packages"],
  request: {
    params: idParams,
    body: body(
      contentSchema.safeExtend({ expectedUpdatedAt: z.string().datetime() }),
    ),
  },
  responses: { 200: result, ...errors },
});

export const updatePackageRouteHandler: AppRouteHandler<
  typeof updatePackageRoute
> = async (c) => {
  const value = await updatePackageService(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
    c.get("session").user.id,
  );

  if ("status" in value) return jsonError(c, value.message, value.status);

  return c.json(value, 200);
};
