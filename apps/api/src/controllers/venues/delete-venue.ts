import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { errors, idParams } from "./http.js";
import { deleteVenueService } from "../../services/venues/venues-service.js";
export const deleteVenueRoute = createRoute({
  method: "delete",
  path: "/admin/venues/{id}",
  tags: ["Venues"],
  request: { params: idParams },
  responses: { 204: { description: "Venue deleted" }, ...errors },
});
export const deleteVenueRouteHandler: AppRouteHandler<
  typeof deleteVenueRoute
> = async (c) => {
  const value = await deleteVenueService(
    c.get("db"),
    c.req.valid("param").id.toLowerCase(),
  );
  if (value) return c.json({ error: value.message }, value.status);
  return c.body(null, 204);
};
