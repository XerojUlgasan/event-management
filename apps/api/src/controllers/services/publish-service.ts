import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { publishServiceService } from "../../services/services/publish-service.js";
export const publishServiceRoute = createRoute({ method: "post", path: "/admin/services/{id}/publish", tags: ["Services"], request: { params: idParams, body: body(z.object({ expectedUpdatedAt: z.string().datetime() })) }, responses: { 200: { content: json(adminSchema), description: "Service catalog" }, ...errors } });
export const publishServiceRouteHandler: AppRouteHandler<typeof publishServiceRoute> = async c => { const value = await publishServiceService(c.get("db"), c.req.valid("param").id, c.req.valid("json").expectedUpdatedAt); if ("status" in value) return c.json({ error: value.message }, value.status); return c.json(value, 200); };
