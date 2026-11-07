import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { updateArrangementService } from "../../services/booking-requests/arrangements.js";
import { bookingSchema, idParams, updateArrangementSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const updateArrangementRoute = createRoute({
  method: "patch",
  path: "/admin/booking-requests/{id}/arrangement",
  tags: ["Booking requests"],
  request: { params: idParams, body: body(updateArrangementSchema) },
  responses: {
    200: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Updated booking arrangement",
    },
    ...errors,
  },
});

export const updateArrangementRouteHandler: AppRouteHandler<
  typeof updateArrangementRoute
> = async (c) => {
  const result = await updateArrangementService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json"),
  );
  if ("message" in result)
    return c.json({ error: result.message }, result.status);
  return c.json({ bookingRequest: result }, 200);
};
