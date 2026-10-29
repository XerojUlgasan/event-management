import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "./http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { getAdminVenueService } from "../../services/venues/venues-service.js";
export const getAdminVenueRoute = createRoute({ method: "get", path: "/admin/venues/{id}", tags: ["Venues"], request: { params: idParams }, responses: {200: {content: json(adminSchema), description: "Venue"}, ...errors} });
export const getAdminVenueRouteHandler: AppRouteHandler<typeof getAdminVenueRoute> = async c => { const value = await getAdminVenueService(c.get("db"), c.req.valid("param").id.toLowerCase()); if ("status" in value) return c.json({error:value.message},value.status); return c.json(value,200); };
