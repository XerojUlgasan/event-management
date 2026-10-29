import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { errors, idParams, result } from "./http.js";
import { archiveVenueService } from "../../services/venues/venues-service.js";

export const archiveVenueRoute = createRoute({ method: "delete", path: "/admin/venues/{id}", tags: ["Venues"],
  request: { params: idParams },
  responses: { 200: result, ...errors },
});
export const archiveVenueRouteHandler: AppRouteHandler<typeof archiveVenueRoute> = async c => {
  const value = await archiveVenueService(c.get("db"), c.req.valid("param").id);
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 200);
};
