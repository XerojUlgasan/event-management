import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { contentSchema } from "./schemas.js";
import { body, errors, result } from "./http.js";
import { createVenueService } from "../../services/venues/venues-service.js";

export const createVenueRoute = createRoute({ method: "post", path: "/admin/venues", tags: ["Venues"],
  request: { body: body(contentSchema) },
  responses: { 201: result, ...errors },
});
export const createVenueRouteHandler: AppRouteHandler<typeof createVenueRoute> = async c => {
  const { name, location, description } = c.req.valid("json");
  const value = await createVenueService(c.get("db"), name, location, description);
  return c.json(value, 201);
};
