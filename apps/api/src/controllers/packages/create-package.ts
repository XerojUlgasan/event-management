import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { contentSchema } from "./schemas.js";
import { json, errors, body, result } from "./http.js";
import { createPackageService } from "../../services/packages/create-package.js";

export const createPackageRoute = createRoute({ method: "post", path: "/admin/packages", tags: ["Packages"], request: { body: body(contentSchema) }, responses: { 201: result, ...errors } });
export const createPackageRouteHandler: AppRouteHandler<typeof createPackageRoute> = async c => {
  const value = await createPackageService(c.get("db"), c.req.valid("json"));
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 201);
};
