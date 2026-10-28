import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { publicSchema } from "./schemas.js";
import { json, errors, idParams } from "./http.js";
import { getPublicPackageService } from "../../services/packages/get-public-package.js";

export const getPublicPackageRoute = createRoute({ method: "get", path: "/packages/{id}", tags: ["Packages"], request: { params: idParams }, responses: {
  200: { content: json(publicSchema), description: "Published package" }, ...errors,
} });
export const getPublicPackageRouteHandler: AppRouteHandler<typeof getPublicPackageRoute> = async c => {
  const row = await getPublicPackageService(c.get("db"), c.req.valid("param").id);
  return row ? c.json(row, 200) : c.json({ error: "Package not found" }, 404);
};
