import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { scheduleRequestedDaysService } from "../../services/event-days/schedule-requested-days.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body } from "../booking-requests/http.js";
import { errorResponse, id, instant, listResponse, tags } from "./schemas.js";

const input = z.strictObject({
  bookingRequestId: id,
  expectedUpdatedAt: instant,
});
export type ScheduleRequestedDaysInput = z.infer<typeof input>;
export const scheduleRequestedDaysRoute = createRoute({
  method: "post",
  path: "/admin/event-days/schedule-requested-days",
  tags,
  request: { body: body(input) },
  responses: listResponse,
});
export const scheduleRequestedDaysRouteHandler: AppRouteHandler<
  typeof scheduleRequestedDaysRoute
> = async (c) => {
  try {
    return c.json(
      {
        eventDays: await scheduleRequestedDaysService(
          c.get("db"),
          c.req.valid("json"),
        ),
      },
      200,
    );
  } catch (e) {
    const error = errorResponse(e);
    return jsonError(c, error.message, error.status);
  }
};
