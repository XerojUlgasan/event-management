import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams } from "./http.js";
import { adminSchema } from "./schemas.js";
import { archiveVenueService } from "../../services/venues/venues-service.js";
export const archiveVenueRoute = createRoute({ method: "post", path: "/admin/venues/{id}/archive", tags: ["Venues"], request: { params: idParams }, responses: { 200: {content: json(adminSchema), description: "Venue catalog"}, ...errors } });
export const archiveVenueRouteHandler: AppRouteHandler<typeof archiveVenueRoute> = async c => { const value = await archiveVenueService(c.get("db"), c.req.valid("param").id.toLowerCase()); if ("status" in value) return c.json({error: value.message}, value.status); return c.json(value, 200); };

// Preserve the original archive endpoint so existing clients never delete a draft accidentally.
export const archiveVenueLegacyRoute = createRoute({ method: "delete", path: "/admin/venues/{id}", tags: ["Venues"], request: { params: idParams }, responses: { 200: {content: json(adminSchema), description: "Archived venue"}, ...errors } });
export const archiveVenueLegacyRouteHandler: AppRouteHandler<typeof archiveVenueLegacyRoute> = async c => { const value = await archiveVenueService(c.get("db"), c.req.valid("param").id.toLowerCase()); if ("status" in value) return c.json({error: value.message}, value.status); return c.json(value, 200); };
