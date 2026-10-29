import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "./http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { publishVenueService } from "../../services/venues/venues-service.js";
export const publishVenueRoute = createRoute({ method: "post", path: "/admin/venues/{id}/publish", tags: ["Venues"], request: { params: idParams, body: body(z.object({ expectedUpdatedAt: z.string().datetime() })) }, responses: { 200: {content: json(adminSchema), description: "Venue catalog"}, ...errors } });
export const publishVenueRouteHandler: AppRouteHandler<typeof publishVenueRoute> = async c => { const value = await publishVenueService(c.get("db"), c.req.valid("param").id.toLowerCase(), c.req.valid("json").expectedUpdatedAt); if ("status" in value) return c.json({error: value.message}, value.status); return c.json(value, 200); };
