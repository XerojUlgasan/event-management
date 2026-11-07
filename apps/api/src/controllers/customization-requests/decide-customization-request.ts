import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { decideCustomizationRequestService } from "../../services/customization-requests/customization-requests.js";
import { bookingSchema, idParams } from "../booking-requests/schemas.js";
import { body, errors, json } from "../booking-requests/http.js";
import { decideCustomizationRequestSchema } from "./schemas.js";

export const decideCustomizationRequestRoute = createRoute({
  method: "patch",
  path: "/admin/customization-requests/{id}",
  tags: ["Customization requests"],
  request: {
    params: idParams,
    body: body(decideCustomizationRequestSchema),
  },
  responses: {
    200: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Customization request decided",
    },
    ...errors,
  },
});

export const decideCustomizationRequestRouteHandler: AppRouteHandler<
  typeof decideCustomizationRequestRoute
> = async (c) => {
  const input = c.req.valid("json");
  const result = await decideCustomizationRequestService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    input.decision,
    input.reason,
  );
  if ("message" in result)
    return c.json({ error: result.message }, result.status);
  return c.json({ bookingRequest: result }, 200);
};
