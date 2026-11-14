import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "./http.js";
import { contentSchema, adminSchema } from "./schemas.js";
import { updateVenueService } from "../../services/venues/venues-service.js";
export const updateVenueRoute = createRoute({
  method: "patch",
  path: "/admin/venues/{id}",
  tags: ["Venues"],
  request: {
    params: idParams,
    body: body(
      contentSchema.extend({ expectedUpdatedAt: z.string().datetime() }),
    ),
  },
  responses: {
    200: { content: json(adminSchema), description: "Venue catalog" },
    ...errors,
  },
});
export const updateVenueRouteHandler: AppRouteHandler<
  typeof updateVenueRoute
> = async (c) => {
  const value = await updateVenueService(
    c.get("db"),
    c.req.valid("param").id.toLowerCase(),
    c.req.valid("json"),
    c.get("session").user.id,
  );
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 200);
};
