import { bookingAddonHoursSchema } from "@event-management/contracts/booking-draft";
import { servicePricingSchema } from "@event-management/contracts/catalog-service-terms";
import { createRoute, z } from "@hono/zod-openapi";
import { changeBookingAddonService } from "../../services/booking-requests/change-booking-addon.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { jsonError } from "../../utils/service-result.js";
import { body, errors, json } from "./http.js";
import { bookingSchema, idParams } from "./schemas.js";

const revision = z.strictObject({
  expectedBookingUpdatedAt: z.string().min(1).max(100),
});

const edit = revision.extend({
  pricing: servicePricingSchema,
  totalHours: bookingAddonHoursSchema,
});

const params = idParams.extend({ addonId: z.string().uuid().toLowerCase() });

const path = "/admin/booking-requests/{id}/addons" as const;

const itemPath = `${path}/{addonId}` as const;

const tags = ["Booking requests"];

const responses = {
  200: {
    content: json(z.object({ bookingRequest: bookingSchema })),
    description: "Updated booking request",
  },
  ...errors,
};

export const addBookingAddonRoute = createRoute({
  method: "post",
  path,
  tags,
  request: {
    params: idParams,
    body: body(edit.extend({ serviceId: z.string().uuid().toLowerCase() })),
  },
  responses,
});

export const addBookingAddonRouteHandler: AppRouteHandler<
  typeof addBookingAddonRoute
> = async (c) => {
  const { id } = c.req.valid("param");
  const { expectedBookingUpdatedAt, serviceId, totalHours, pricing } =
    c.req.valid("json");
  const result = await changeBookingAddonService(
    c.get("db"),
    id,
    c.get("session").user.id,
    expectedBookingUpdatedAt,
    { kind: "add", serviceId, offer: { ...pricing, totalHours } },
  );

  return "status" in result
    ? jsonError(c, result.message, result.status)
    : c.json(result, 200);
};

export const editBookingAddonRoute = createRoute({
  method: "patch",
  path: itemPath,
  tags,
  request: { params, body: body(edit) },
  responses,
});

export const editBookingAddonRouteHandler: AppRouteHandler<
  typeof editBookingAddonRoute
> = async (c) => {
  const { id, addonId } = c.req.valid("param");
  const { expectedBookingUpdatedAt, totalHours, pricing } = c.req.valid("json");
  const result = await changeBookingAddonService(
    c.get("db"),
    id,
    c.get("session").user.id,
    expectedBookingUpdatedAt,
    { kind: "edit", addonId, offer: { ...pricing, totalHours } },
  );

  return "status" in result
    ? jsonError(c, result.message, result.status)
    : c.json(result, 200);
};

export const removeBookingAddonRoute = createRoute({
  method: "delete",
  path: itemPath,
  tags,
  request: { params, body: body(revision) },
  responses,
});

export const removeBookingAddonRouteHandler: AppRouteHandler<
  typeof removeBookingAddonRoute
> = async (c) => {
  const { id, addonId } = c.req.valid("param");
  const { expectedBookingUpdatedAt } = c.req.valid("json");
  const result = await changeBookingAddonService(
    c.get("db"),
    id,
    c.get("session").user.id,
    expectedBookingUpdatedAt,
    { kind: "remove", addonId },
  );

  return "status" in result
    ? jsonError(c, result.message, result.status)
    : c.json(result, 200);
};
