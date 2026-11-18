import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { updateBookingStatusService } from "../../services/booking-requests/update-booking-status.js";
import { bookingSchema, idParams, updateStatusSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";
export const updateBookingStatusRoute = createRoute({
  method: "patch",
  path: "/admin/booking-requests/{id}/status",
  tags: ["Booking requests"],
  request: { params: idParams, body: body(updateStatusSchema) },
  responses: {
    200: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Status updated",
    },
    ...errors,
  },
});
export const updateBookingStatusRouteHandler: AppRouteHandler<
  typeof updateBookingStatusRoute
> = async (c) => {
  const input = c.req.valid("json");
  const result = await updateBookingStatusService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    input.status,
    input.reason,
  );
  if ("message" in result)
    return jsonError(c, result.message, result.status);
  return c.json({ bookingRequest: result }, 200);
};
