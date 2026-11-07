import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { createCustomizationRequestService } from "../../services/customization-requests/customization-requests.js";
import { bookingSchema, idParams } from "../booking-requests/schemas.js";
import { errors, json } from "../booking-requests/http.js";
import { createCustomizationRequestSchema } from "./schemas.js";

const createRouteDefinition = (path: "/admin/booking-requests/{id}/customization-requests" | "/booking-requests/{id}/customization-requests") => createRoute({
  method: "post",
  path,
  tags: ["Customization requests"],
  request: {
    params: idParams,
    body: { content: json(createCustomizationRequestSchema), required: true },
  },
  responses: {
    201: {
      content: json(z.object({ bookingRequest: bookingSchema })),
      description: "Customization request recorded",
    },
    ...errors,
  },
});

export const createCustomizationRequestRoute = createRouteDefinition("/admin/booking-requests/{id}/customization-requests");
export const createCustomerCustomizationRequestRoute = createRouteDefinition("/booking-requests/{id}/customization-requests");

export const createCustomizationRequestRouteHandler: AppRouteHandler<
  typeof createCustomizationRequestRoute
> = async (c) => {
  const result = await createCustomizationRequestService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.get("session").user.role === "customer" ? "customer" : "admin",
    c.req.valid("json"),
  );
  if ("message" in result)
    return c.json({ error: result.message }, result.status);
  return c.json({ bookingRequest: result }, 201);
};

export const createCustomerCustomizationRequestRouteHandler: AppRouteHandler<
  typeof createCustomerCustomizationRequestRoute
> = async (c) => {
  const result = await createCustomizationRequestService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    "customer",
    c.req.valid("json"),
  );
  if ("message" in result)
    return c.json({ error: result.message }, result.status);
  return c.json({ bookingRequest: result }, 201);
};
