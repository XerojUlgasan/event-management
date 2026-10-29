import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "./http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { listAdminVenuesService } from "../../services/venues/venues-service.js";
export const listAdminVenuesRoute = createRoute({ method: "get", path: "/admin/venues", tags: ["Venues"], responses: {200: {content: json(z.object({venues: z.array(adminSchema)})), description: "Admin venue catalog"}, ...errors} });
export const listAdminVenuesRouteHandler: AppRouteHandler<typeof listAdminVenuesRoute> = async c => c.json(await listAdminVenuesService(c.get("db")), 200);
