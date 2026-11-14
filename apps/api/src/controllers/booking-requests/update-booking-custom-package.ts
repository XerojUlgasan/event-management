import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { idParams } from "./schemas.js";
import { json } from "./http.js";
import { saveSchema, saveResponses } from "./custom-package-schemas.js";
import { saveCustomPackageService } from "../../services/booking-requests/save-custom-package.js";

export const updateBookingCustomPackageRoute = createRoute({
  method: "patch",
  path: "/admin/booking-requests/{id}/custom-package",
  tags: ["Booking requests"],
  request: {
    params: idParams,
    body: { required: true, content: json(saveSchema) },
  },
  responses: saveResponses,
});
export const updateBookingCustomPackageRouteHandler: AppRouteHandler<
  typeof updateBookingCustomPackageRoute
> = async (c) => {
  const result = await saveCustomPackageService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json"),
    false,
  );
  return "status" in result
    ? c.json({ error: result.message }, result.status)
    : c.json(result, 200);
};
