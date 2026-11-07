import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { withdrawCustomizationRequestService } from "../../services/customization-requests/customization-requests.js";
import { bookingSchema, idParams } from "../booking-requests/schemas.js";
import { errors, json } from "../booking-requests/http.js";

export const withdrawCustomizationRequestRoute = createRoute({
  method: "patch",
  path: "/customization-requests/{id}/withdraw",
  tags: ["Customization requests"],
  request: { params: idParams },
  responses: {
    200: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Customization request withdrawn",
    },
    ...errors,
  },
});

export const withdrawCustomizationRequestRouteHandler: AppRouteHandler<
  typeof withdrawCustomizationRequestRoute
> = async (c) => {
  const result = await withdrawCustomizationRequestService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
  );
  if ("message" in result)
    return c.json({ error: result.message }, result.status);
  return c.json({ bookingRequest: result }, 200);
};