import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "./http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { createVenueService } from "../../services/venues/venues-service.js";
export const createVenueRoute = createRoute({
  method: "post",
  path: "/admin/venues",
  tags: ["Venues"],
  request: { body: body(contentSchema) },
  responses: {
    201: { content: json(adminSchema), description: "Venue catalog" },
    ...errors,
  },
});
export const createVenueRouteHandler: AppRouteHandler<
  typeof createVenueRoute
> = async (c) => {
  const value = await createVenueService(
    c.get("db"),
    c.req.valid("json"),
    c.get("session").user.id,
  );
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 201);
};
