import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { cancelBookingRequestService } from "../../services/booking-requests/cancel-booking-request.js";
import { bookingSchema, cancelSchema, idParams } from "./schemas.js";
import { body, errors, json } from "./http.js";
export const cancelBookingRequestRoute = createRoute({ method: "patch", path: "/booking-requests/{id}/cancel", tags: ["Booking requests"], request: { params: idParams, body: body(cancelSchema) }, responses: { 200: { content: json(z.object({ bookingRequest: bookingSchema })), description: "Request cancelled" }, ...errors } });
export const cancelBookingRequestRouteHandler: AppRouteHandler<typeof cancelBookingRequestRoute> = async c => {
  const result = await cancelBookingRequestService(c.get("db"), c.req.valid("param").id, c.get("session").user.id, c.req.valid("json").reason);
  if ("message" in result) return c.json({ error: result.message }, result.status);
  return c.json({ bookingRequest: result }, 200);
};
