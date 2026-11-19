import { OpenAPIHono } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { createMiddleware } from "hono/factory";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  createQuotationRoute,
  createQuotationRouteHandler,
} from "./create-quotation.js";
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
  reviseAdminQuotationRoute,
  reviseAdminQuotationRouteHandler,
} from "./revise-quotation.js";
import {
  saveQuotationRoute,
  saveQuotationRouteHandler,
} from "./save-quotation.js";
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

routes.use(
  "/admin/booking-requests/:id/quotations",
  requireSession,
  requireSystemAdmin,
);
routes.use("/admin/quotations/*", requireSession, requireSystemAdmin);
routes.use("/booking-requests/:id/quotations", requireSession, customer);
routes.use("/quotations/*", requireSession, customer);

routes.openapi(createQuotationRoute, createQuotationRouteHandler);
routes.openapi(listAdminQuotationsRoute, listAdminQuotationsRouteHandler);
routes.openapi(listCustomerQuotationsRoute, listCustomerQuotationsRouteHandler);
routes.openapi(getQuotationRoute, getQuotationRouteHandler);
routes.openapi(saveQuotationRoute, saveQuotationRouteHandler);
routes.openapi(sendQuotationRoute, sendQuotationRouteHandler);
routes.openapi(reviseAdminQuotationRoute, reviseAdminQuotationRouteHandler);

export default routes;
