import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { respondToEventService } from "../../services/events/events.js";
import { bookingRequestIdParams, respondSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const respondToEventRoute = createRoute({
  method: "patch",
  path: "/staff/events/{bookingRequestId}/response",
  tags: ["Events"],
  request: {
    params: bookingRequestIdParams,
    body: body(respondSchema),
  },
  responses: {
    200: {
      content: json(z.object({ response: z.enum(["available", "unavailable"]).nullable() })),
      description: "Response saved",
    },
    ...errors,
  },
});

export const respondToEventRouteHandler: AppRouteHandler<typeof respondToEventRoute> = async (c) => {
  const { bookingRequestId } = c.req.valid("param");
  const { response } = c.req.valid("json");
  const result = await respondToEventService(
    c.get("db"),
    bookingRequestId,
    c.get("session").user.id,
    response,
  );
  if ("message" in result) return c.json({ error: result.message }, result.status);
  return c.json({ response: result.response }, 200);
};
