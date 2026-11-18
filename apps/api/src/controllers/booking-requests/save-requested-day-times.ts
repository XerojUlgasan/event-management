import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { saveRequestedDayTimesService } from "../../services/booking-requests/save-requested-day-times.js";
import {
  bookingSchema,
  requestedDayParams,
  saveRequestedDayTimesSchema,
} from "./schemas.js";
import { body, errors, json } from "./http.js";
export const saveRequestedDayTimesRoute = createRoute({
  method: "patch",
  path: "/booking-requests/{id}/requested-days/{date}/times",
  tags: ["Booking requests"],
  request: {
    params: requestedDayParams,
    body: body(saveRequestedDayTimesSchema),
  },
  responses: {
    200: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Requested day times saved",
    },
    ...errors,
  },
});
export const saveRequestedDayTimesRouteHandler: AppRouteHandler<
  typeof saveRequestedDayTimesRoute
> = async (c) => {
  const { id, date } = c.req.valid("param");
  const result = await saveRequestedDayTimesService(
    c.get("db"),
    id,
    date,
    c.get("session").user.id,
    c.req.valid("json"),
  );
  if ("message" in result)
    return jsonError(c, result.message, result.status);
  return c.json({ bookingRequest: result }, 200);
};
