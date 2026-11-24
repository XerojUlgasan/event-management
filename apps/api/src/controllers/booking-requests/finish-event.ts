import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { finishEventService } from "../../services/booking-requests/finish-event.js";
import { bookingSchema, idParams } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const finishEventRoute = createRoute({
  method: "post",
  path: "/admin/booking-requests/{id}/finish",
  tags: ["Booking requests"],
  request: {
    params: idParams,
    body: body(z.strictObject({ expectedUpdatedAt: z.iso.datetime() })),
  },
  responses: {
    200: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Event finished",
    },
    ...errors,
  },
});

export const finishEventRouteHandler: AppRouteHandler<
  typeof finishEventRoute
> = async (c) => {
  const result = await finishEventService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json").expectedUpdatedAt,
  );

  if ("message" in result) return jsonError(c, result.message, result.status);

  return c.json({ bookingRequest: result }, 200);
};
