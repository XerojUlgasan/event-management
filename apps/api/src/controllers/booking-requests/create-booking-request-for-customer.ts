import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { createBookingRequestService } from "../../services/booking-requests/create-booking-request.js";
import { adminCreateSchema, bookingSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const createBookingRequestForCustomerRoute = createRoute({
  method: "post",
  path: "/admin/booking-requests/for-customer",
  tags: ["Booking requests"],
  request: { body: body(adminCreateSchema) },
  responses: {
    201: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Booking request created on behalf of customer",
    },
    ...errors,
  },
});

export const createBookingRequestForCustomerRouteHandler: AppRouteHandler<
  typeof createBookingRequestForCustomerRoute
> = async (c) => {
  const { customerId, conversationId, ...input } = c.req.valid("json");
  const result = await createBookingRequestService(
    c.get("db"),
    customerId,
    input,
    { conversationId, skipDateGuard: true },
  );
  if ("message" in result)
    return c.json({ error: result.message }, result.status);
  return c.json({ bookingRequest: result }, 201);
};
