import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, body } from "./http.js";
import { deleteVenueImageService } from "../../services/venues/delete-venue-image.js";

export const deleteVenueImageRoute = createRoute({ method: "delete", path: "/admin/venue-images/{id}", tags: ["Venues"], request: { params: idParams }, responses: {
  204: { description: "Unreferenced image deleted" }, ...errors,
} });
export const deleteVenueImageRouteHandler: AppRouteHandler<typeof deleteVenueImageRoute> = async c => {
  const id = c.req.valid("param").id.toLowerCase();
  const outcome = await deleteVenueImageService(c.get("db"), id);
  if (outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.body(null, 204);
};
