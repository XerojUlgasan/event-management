import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, slugParams } from "./http.js";
import { publicSchema } from "./schemas.js";
import { getVenueBySlugService } from "../../services/venues/venues-service.js";

export const getVenueBySlugRoute = createRoute({
  method: "get",
  path: "/venues/slug/{slug}",
  tags: ["Venues"],
  request: { params: slugParams },
  responses: {
    200: { content: json(publicSchema), description: "Venue" },
    ...errors,
  },
});

export const getVenueBySlugRouteHandler: AppRouteHandler<
  typeof getVenueBySlugRoute
> = async (c) => {
  const value = await getVenueBySlugService(
    c.get("db"),
    c.req.valid("param").slug,
  );
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 200);
};
