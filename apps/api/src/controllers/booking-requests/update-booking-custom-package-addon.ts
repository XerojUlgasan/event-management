import { servicePricingSchema } from "@event-management/contracts/catalog-service-terms";
import { createRoute, z } from "@hono/zod-openapi";
import { updateCustomPackageAddonService } from "../../services/booking-requests/update-custom-package-addon.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { jsonError } from "../../utils/service-result.js";
import { saveResponses } from "./custom-package-schemas.js";
import { body, errors } from "./http.js";
import { idParams } from "./schemas.js";

const source = z.strictObject({
  packageId: z.string().uuid(),
  expectedBookingUpdatedAt: z.string().min(1).max(100),
  expectedUpdatedAt: z.string().datetime(),
});

const params = idParams.extend({ addonId: z.string().uuid() });

const path = "/admin/booking-requests/{id}/custom-package/addons/{addonId}";

const responses = { 200: saveResponses[200], ...errors };

const edit = servicePricingSchema.safeExtend(source.shape);

export const updateBookingCustomPackageAddonRoute = createRoute({
  method: "patch",
  path,
  tags: ["Booking requests"],
  request: { params, body: body(edit) },
  responses,
});

export const updateBookingCustomPackageAddonRouteHandler: AppRouteHandler<
  typeof updateBookingCustomPackageAddonRoute
> = async (c) => {
  const { id, addonId } = c.req.valid("param");
  const { hourlyRatePesos, includedHours, fixedPricePesos, ...expected } =
    c.req.valid("json");
  const result = await updateCustomPackageAddonService(
    c.get("db"),
    id,
    c.get("session").user.id,
    addonId,
    expected,
    { hourlyRatePesos, includedHours, fixedPricePesos },
  );

  return "status" in result
    ? jsonError(c, result.message, result.status)
    : c.json(result, 200);
};

export const deleteBookingCustomPackageAddonRoute = createRoute({
  method: "delete",
  path,
  tags: ["Booking requests"],
  request: { params, body: body(source) },
  responses,
});

export const deleteBookingCustomPackageAddonRouteHandler: AppRouteHandler<
  typeof deleteBookingCustomPackageAddonRoute
> = async (c) => {
  const { id, addonId } = c.req.valid("param");
  const result = await updateCustomPackageAddonService(
    c.get("db"),
    id,
    c.get("session").user.id,
    addonId,
    c.req.valid("json"),
    null,
  );

  return "status" in result
    ? jsonError(c, result.message, result.status)
    : c.json(result, 200);
};
