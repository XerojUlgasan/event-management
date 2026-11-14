import { createRoute, z } from "@hono/zod-openapi";
import * as service from "../../services/event-days/update-event-day-staffing.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body } from "../booking-requests/http.js";
import {
  daysBefore,
  errorResponse,
  params,
  response,
  tags,
} from "./schemas.js";
export const updateEventDayStaffingRoute = createRoute({
  method: "patch",
  path: "/admin/event-days/{id}/staffing",
  tags,
  request: {
    params,
    body: body(
      z.discriminatedUnion("staffingStatus", [
        z.strictObject({ staffingStatus: z.literal("open"), daysBefore }),
        z.strictObject({ staffingStatus: z.literal("closed") }),
      ]),
    ),
  },
  responses: response,
});
export const updateEventDayStaffingRouteHandler: AppRouteHandler<
  typeof updateEventDayStaffingRoute
> = async (c) => {
  try {
    return c.json(
      {
        eventDay: await service.staffingEventDayService(
          c.get("db"),
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
      },
      200,
    );
  } catch (e) {
    const error = errorResponse(e);
    return c.json({ error: error.message }, error.status);
  }
};
