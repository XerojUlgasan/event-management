import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { venueSchema } from "./schemas.js";
import { json, errors, idParams } from "./http.js";
import { findVenueData } from "../../data/venues/find-venue.js";
import { venueDto } from "../../services/venues/venue-response.js";

export const getVenueRoute = createRoute({ method: "get", path: "/venues/{id}", tags: ["Venues"],
  request: { params: idParams },
  responses: { 200: { content: json(venueSchema), description: "Venue" }, ...errors },
});
export const getVenueRouteHandler: AppRouteHandler<typeof getVenueRoute> = async c => {
  const row = await findVenueData(c.get("db"), c.req.valid("param").id);
  return row ? c.json(venueDto(row), 200) : c.json({ error: "Venue not found" }, 404);
};
