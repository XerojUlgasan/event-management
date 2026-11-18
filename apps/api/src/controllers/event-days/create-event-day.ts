import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import * as service from "../../services/event-days/create-event-day.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, json } from "../booking-requests/http.js";
import { dto, errorResponse, id, response, schedule, tags } from "./schemas.js";
export const createEventDayRoute = createRoute({
  method: "post",
  path: "/admin/event-days",
  tags,
  request: { body: body(schedule.extend({ bookingRequestId: id })) },
  responses: {
    ...response,
    201: {
      content: json(z.object({ eventDay: dto })),
      description: "Created event day",
    },
  },
});
export const createEventDayRouteHandler: AppRouteHandler<
  typeof createEventDayRoute
> = async (c) => {
  try {
    const { bookingRequestId, ...input } = c.req.valid("json");
    return c.json(
      {
        eventDay: await service.createEventDayService(
          c.get("db"),
          bookingRequestId,
          input,
        ),
      },
      201,
    );
  } catch (e) {
    const error = errorResponse(e);
    return jsonError(c, error.message, error.status);
  }
};
