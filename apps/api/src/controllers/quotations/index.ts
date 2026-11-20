import { OpenAPIHono } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { createMiddleware } from "hono/factory";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  getQuotationRoute,
  getQuotationRouteHandler,
} from "./get-quotation.js";
import {
  listAdminQuotationsRoute,
  listAdminQuotationsRouteHandler,
  listCustomerQuotationsRoute,
  listCustomerQuotationsRouteHandler,
} from "./list-quotations.js";
import {
  prepareQuotationRoute,
  prepareQuotationRouteHandler,
} from "./prepare-quotation.js";
import {
  sendQuotationRoute,
  sendQuotationRouteHandler,
} from "./send-quotation.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) =>
    result.success
      ? undefined
      : c.json(
          {
            error: result.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          },
          400,
        ),
});

const customer = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer")
    return jsonError(c, "Customer access required", 403);

  await next();
});

// Admin booking routes inherit middleware from the booking-request router.
routes.use("/booking-requests/:id/quotations", requireSession, customer);
routes.use("/quotations/*", requireSession, customer);

routes.openapi(prepareQuotationRoute, prepareQuotationRouteHandler);
routes.openapi(listAdminQuotationsRoute, listAdminQuotationsRouteHandler);
routes.openapi(listCustomerQuotationsRoute, listCustomerQuotationsRouteHandler);
routes.openapi(getQuotationRoute, getQuotationRouteHandler);
routes.openapi(sendQuotationRoute, sendQuotationRouteHandler);

export default routes;
