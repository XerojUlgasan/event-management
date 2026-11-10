import { createRoute } from "@hono/zod-openapi";
import * as service from "../../services/event-days/cancel-event-day.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { errorResponse, params, response, tags } from "./schemas.js";
export const cancelEventDayRoute = createRoute({
  method: "post",
  path: "/admin/event-days/{id}/cancel",
  tags,
  request: { params },
  responses: response,
});
export const cancelEventDayRouteHandler: AppRouteHandler<
  typeof cancelEventDayRoute
> = async (c) => {
  try {
    return c.json(
      {
        eventDay: await service.cancelEventDayService(
          c.get("db"),
          c.req.valid("param").id,
        ),
      },
      200,
    );
  } catch (e) {
    const error = errorResponse(e);
    return c.json({ error: error.message }, error.status);
  }
};
