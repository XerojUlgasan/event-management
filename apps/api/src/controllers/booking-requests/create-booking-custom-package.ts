import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { idParams } from "./schemas.js";
import { json } from "./http.js";
import { saveSchema, saveResponses } from "./custom-package-schemas.js";
import { saveCustomPackageService } from "../../services/booking-requests/save-custom-package.js";

export const createBookingCustomPackageRoute = createRoute({
  method: "post",
  path: "/admin/booking-requests/{id}/custom-package",
  tags: ["Booking requests"],
  request: {
    params: idParams,
    body: { required: true, content: json(saveSchema) },
  },
  responses: saveResponses,
});
export const createBookingCustomPackageRouteHandler: AppRouteHandler<
  typeof createBookingCustomPackageRoute
> = async (c) => {
  const result = await saveCustomPackageService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json"),
    true,
  );
  return "status" in result
    ? jsonError(c, result.message, result.status)
    : c.json(result, 200);
};
