import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "./http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { getVenueService } from "../../services/venues/venues-service.js";
export const getVenueRoute = createRoute({
  method: "get",
  path: "/venues/{id}",
  tags: ["Venues"],
  request: { params: idParams },
  responses: {
    200: { content: json(publicSchema), description: "Venue" },
    ...errors,
  },
});
export const getVenueRouteHandler: AppRouteHandler<
  typeof getVenueRoute
> = async (c) => {
  const value = await getVenueService(
    c.get("db"),
    c.req.valid("param").id.toLowerCase(),
  );
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 200);
};
