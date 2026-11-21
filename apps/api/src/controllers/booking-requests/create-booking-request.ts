import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { createBookingRequestService } from "../../services/booking-requests/create-booking-request.js";
import { bookingSchema, createSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const createBookingRequestRoute = createRoute({
  method: "post",
  path: "/booking-requests",
  tags: ["Booking requests"],
  request: { body: body(createSchema) },
  responses: {
    201: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Request submitted",
    },
    ...errors,
    409: {
      ...errors[409],
      content: json(
        z.object({
          error: z.string(),
          code: z
            .enum(["requested_addon_conflict", "booking_package_changed"])
            .optional(),
          resourceId: z.string().uuid().optional(),
        }),
      ),
    },
  },
});

export const createBookingRequestRouteHandler: AppRouteHandler<
  typeof createBookingRequestRoute
> = async (c) => {
  const result = await createBookingRequestService(
    c.get("db"),
    c.get("session").user.id,
    c.req.valid("json"),
  );

  if ("message" in result) {
    if ("code" in result)
      return c.json(
        {
          error: result.message,
          code: result.code,
          ...("resourceId" in result ? { resourceId: result.resourceId } : {}),
        },
        409,
      );

    return jsonError(c, result.message, result.status);
  }

  return c.json({ bookingRequest: result }, 201);
};
