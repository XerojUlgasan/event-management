import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "./http.js";
import { contentSchema, adminSchema } from "./schemas.js";
import { updateVenueService } from "../../services/venues/venues-service.js";
export const updateVenueRoute = createRoute({ method: "patch", path: "/admin/venues/{id}/draft", tags: ["Venues"], request: { params: idParams, body: body(contentSchema.extend({ expectedUpdatedAt: z.string().datetime() })) }, responses: { 200: {content: json(adminSchema), description: "Venue catalog"}, ...errors } });
export const updateVenueRouteHandler: AppRouteHandler<typeof updateVenueRoute> = async c => { const value = await updateVenueService(c.get("db"), c.req.valid("param").id.toLowerCase(), c.req.valid("json")); if ("status" in value) return c.json({error: value.message}, value.status); return c.json(value, 200); };

// A legacy immediate edit cannot safely publish under the versioned lifecycle.
export const updateVenueLegacyRoute = createRoute({ method: "patch", path: "/admin/venues/{id}", tags: ["Venues"], request: { params: idParams }, responses: { 409: errors[409], 401: errors[401], 403: errors[403] } });
export const updateVenueLegacyRouteHandler: AppRouteHandler<typeof updateVenueLegacyRoute> = async c => c.json({ error: "Venue editing now uses versioned drafts. Refresh the app and try again." }, 409);
