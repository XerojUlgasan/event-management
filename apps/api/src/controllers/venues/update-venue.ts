import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { contentSchema } from "./schemas.js";
import { body, errors, idParams, result } from "./http.js";
import { updateVenueService } from "../../services/venues/venues-service.js";

export const updateVenueRoute = createRoute({ method: "patch", path: "/admin/venues/{id}", tags: ["Venues"],
  request: { params: idParams, body: body(contentSchema) },
  responses: { 200: result, ...errors },
});
export const updateVenueRouteHandler: AppRouteHandler<typeof updateVenueRoute> = async c => {
  const { name, location, description } = c.req.valid("json");
  const value = await updateVenueService(c.get("db"), c.req.valid("param").id, name, location, description);
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 200);
};
