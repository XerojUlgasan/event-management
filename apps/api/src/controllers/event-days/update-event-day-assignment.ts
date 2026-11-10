import { createRoute, z } from "@hono/zod-openapi";
import * as service from "../../services/event-days/update-event-day-assignment.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body } from "../booking-requests/http.js";
import { errorResponse, id, params, response, tags } from "./schemas.js";
export const updateEventDayAssignmentRoute = createRoute({
  method: "put",
  path: "/admin/event-days/{id}/assignments/{staffId}",
  tags,
  request: {
    params: params.extend({ staffId: id }),
    body: body(
      z.object({
        role: z.enum(["coordinator", "helper"]),
        status: z.enum(["confirmed", "cancelled"]),
      }),
    ),
  },
  responses: response,
});
export const updateEventDayAssignmentRouteHandler: AppRouteHandler<
  typeof updateEventDayAssignmentRoute
> = async (c) => {
  try {
    const { id, staffId } = c.req.valid("param");
    return c.json(
      {
        eventDay: await service.assignmentEventDayService(
          c.get("db"),
          id,
          staffId,
          c.get("session").user.id,
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
