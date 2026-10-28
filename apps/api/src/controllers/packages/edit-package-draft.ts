import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { contentSchema } from "./schemas.js";
import { json, errors, idParams, body, result } from "./http.js";
import { editPackageDraftService } from "../../services/packages/edit-package-draft.js";

export const editPackageDraftRoute = createRoute({ method: "patch", path: "/admin/packages/{id}/draft", tags: ["Packages"], request: { params: idParams, body: body(contentSchema.extend({ expectedUpdatedAt: z.string().datetime() })) }, responses: { 200: result, ...errors } });
export const editPackageDraftRouteHandler: AppRouteHandler<typeof editPackageDraftRoute> = async c => {
  const outcome = await editPackageDraftService(c.get("db"), c.req.valid("param").id, c.req.valid("json"));
  if ("status" in outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.json(outcome, 200);
};
