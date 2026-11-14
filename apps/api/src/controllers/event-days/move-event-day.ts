import { createRoute } from "@hono/zod-openapi";
import * as service from "../../services/event-days/move-event-day.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body } from "../booking-requests/http.js";
import { errorResponse, params, response, schedule, tags } from "./schemas.js";
export const moveEventDayRoute = createRoute({
  method: "post",
  path: "/admin/event-days/{id}/move",
  tags,
  request: { params, body: body(schedule) },
  responses: response,
});
export const moveEventDayRouteHandler: AppRouteHandler<
  typeof moveEventDayRoute
> = async (c) => {
  try {
    return c.json(
      {
        eventDay: await service.moveEventDayService(
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
