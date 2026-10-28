import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, body, result } from "./http.js";
import { publishPackageService } from "../../services/packages/publish-package.js";

export const publishPackageRoute = createRoute({ method: "post", path: "/admin/packages/{id}/publish", tags: ["Packages"], request: { params: idParams, body: body(z.object({ expectedUpdatedAt: z.string().datetime() })) }, responses: { 200: result, ...errors } });
export const publishPackageRouteHandler: AppRouteHandler<typeof publishPackageRoute> = async c => {
  const outcome = await publishPackageService(c.get("db"), c.req.valid("param").id, c.req.valid("json").expectedUpdatedAt);
  if ("status" in outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.json(outcome, 200);
};
