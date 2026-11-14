import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { getBookingRequestService } from "../../services/booking-requests/get-booking-request.js";
import { bookingSchema, idParams } from "./schemas.js";
import { errors, json } from "./http.js";

const responses = {
  200: {
    content: json(z.object({ bookingRequest: bookingSchema })),
    description: "Booking request",
  },
  400: errors[400],
  401: errors[401],
  403: errors[403],
  404: errors[404],
};
export const getMyBookingRequestRoute = createRoute({
  method: "get",
  path: "/booking-requests/{id}",
  tags: ["Booking requests"],
  request: { params: idParams },
  responses,
});
export const getMyBookingRequestRouteHandler: AppRouteHandler<
  typeof getMyBookingRequestRoute
> = async (c) => {
  const bookingRequest = await getBookingRequestService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
  );
  if (!bookingRequest)
    return c.json({ error: "Booking request not found" }, 404);
  return c.json({ bookingRequest }, 200);
};
export const getAdminBookingRequestRoute = createRoute({
  method: "get",
  path: "/admin/booking-requests/{id}",
  tags: ["Booking requests"],
  request: { params: idParams },
  responses,
});
export const getAdminBookingRequestRouteHandler: AppRouteHandler<
  typeof getAdminBookingRequestRoute
> = async (c) => {
  const bookingRequest = await getBookingRequestService(
    c.get("db"),
    c.req.valid("param").id,
  );
  if (!bookingRequest)
    return c.json({ error: "Booking request not found" }, 404);
  return c.json({ bookingRequest }, 200);
};
