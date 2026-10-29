import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { venueSchema } from "./schemas.js";
import { json } from "./http.js";
import { listVenuesService } from "../../services/venues/venues-service.js";

export const listVenuesRoute = createRoute({ method: "get", path: "/venues", tags: ["Venues"], responses: {
  200: { content: json(z.object({ venues: z.array(venueSchema) })), description: "Active venues" },
} });
export const listVenuesRouteHandler: AppRouteHandler<typeof listVenuesRoute> = async c =>
  c.json(await listVenuesService(c.get("db")), 200);
