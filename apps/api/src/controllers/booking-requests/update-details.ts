import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { updateDetailsService } from "../../services/booking-requests/details.js";
import { bookingSchema, idParams, updateDetailsSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const updateDetailsRoute = createRoute({
  method: "patch",
  path: "/admin/booking-requests/{id}/details",
  tags: ["Booking requests"],
  request: { params: idParams, body: body(updateDetailsSchema) },
  responses: {
    200: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Updated booking details",
    },
    ...errors,
  },
});

export const updateDetailsRouteHandler: AppRouteHandler<
  typeof updateDetailsRoute
> = async (c) => {
  const result = await updateDetailsService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json"),
  );
  if ("message" in result)
    return c.json({ error: result.message }, result.status);
  return c.json({ bookingRequest: result }, 200);
};
