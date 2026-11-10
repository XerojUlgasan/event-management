import { createRoute, z } from "@hono/zod-openapi";
import { applyResponseDeadlinesService } from "../../services/event-days/apply-response-deadlines.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body } from "../booking-requests/http.js";
import { daysBefore, errorResponse, id, instant, listResponse, tags } from "./schemas.js";

const input = z.strictObject({ bookingRequestId: id, daysBefore, expectedUpdatedAt: instant });
export type ApplyResponseDeadlinesInput = z.infer<typeof input>;
export const applyResponseDeadlinesRoute = createRoute({
  method: "post",
  path: "/admin/event-days/apply-response-deadlines",
  tags,
  request: { body: body(input) },
  responses: listResponse,
});
export const applyResponseDeadlinesRouteHandler: AppRouteHandler<typeof applyResponseDeadlinesRoute> = async c => {
  try {
    return c.json({ eventDays: await applyResponseDeadlinesService(c.get("db"), c.req.valid("json")) }, 200);
  } catch (e) {
    const error = errorResponse(e);
    return c.json({ error: error.message }, error.status);
  }
};
