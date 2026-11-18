import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { attachBookingPackageService } from "../../services/booking-requests/attach-booking-package.js";
import { bookingSchema, idParams } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const attachBookingPackageRoute = createRoute({
  method: "post",
  path: "/admin/booking-requests/{id}/package",
  tags: ["Booking requests"],
  request: {
    params: idParams,
    body: body(
      z
        .object({
          packageId: z.string().uuid(),
          expectedBookingUpdatedAt: z.string(),
          packageUpdatedAt: z.string().datetime().optional(),
        })
        .strict(),
    ),
  },
  responses: {
    200: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Package attached",
    },
    ...errors,
  },
});
export const attachBookingPackageRouteHandler: AppRouteHandler<
  typeof attachBookingPackageRoute
> = async (c) => {
  const result = await attachBookingPackageService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json"),
  );
  return "message" in result
    ? jsonError(c, result.message, result.status)
    : c.json(result, 200);
};
