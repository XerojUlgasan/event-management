import { createRoute, z } from "@hono/zod-openapi";
import * as service from "../../services/event-days/respond-event-day-availability.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body } from "../booking-requests/http.js";
import { errorResponse, params, response, tags } from "./schemas.js";
export const respondEventDayAvailabilityRoute = createRoute({
  method: "put",
  path: "/staff/event-days/{id}/availability",
  tags,
  request: {
    params,
    body: body(z.object({ response: z.enum(["available", "unavailable"]) })),
  },
  responses: response,
});
export const respondEventDayAvailabilityRouteHandler: AppRouteHandler<
  typeof respondEventDayAvailabilityRoute
> = async (c) => {
  try {
    return c.json(
      {
        eventDay: await service.availabilityEventDayService(
          c.get("db"),
          c.req.valid("param").id,
          c.get("session").user.id,
          c.req.valid("json").response,
        ),
      },
      200,
    );
  } catch (e) {
    const error = errorResponse(e);
    return c.json({ error: error.message }, error.status);
  }
};
