import {
  getMyStatusHistoryRoute,
  getMyStatusHistoryRouteHandler,
  getAdminStatusHistoryRoute,
  getAdminStatusHistoryRouteHandler,
} from "./get-status-history.js";
import {
  saveRequestedDayTimesRoute,
  saveRequestedDayTimesRouteHandler,
} from "./save-requested-day-times.js";
import quotationRoutes from "../quotations/index.js";
import {
  getMyBookingPackageRoute,
  getMyBookingPackageRouteHandler,
  getAdminBookingPackageRoute,
  getAdminBookingPackageRouteHandler,
} from "./get-booking-package.js";
import {
  getAdminBookingPackageHistoryRoute,
  getAdminBookingPackageHistoryRouteHandler,
} from "./get-booking-package-history.js";
import {
  createBookingCustomPackageRoute,
  createBookingCustomPackageRouteHandler,
} from "./create-booking-custom-package.js";
import {
  updateBookingCustomPackageRoute,
  updateBookingCustomPackageRouteHandler,
} from "./update-booking-custom-package.js";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  createBookingRequestRoute,
  createBookingRequestRouteHandler,
} from "./create-booking-request.js";
import {
  listMyBookingRequestsRoute,
  listMyBookingRequestsRouteHandler,
  listAdminBookingRequestsRoute,
  listAdminBookingRequestsRouteHandler,
} from "./list-booking-requests.js";
import {
  cancelBookingRequestRoute,
  cancelBookingRequestRouteHandler,
} from "./cancel-booking-request.js";
import {
  updateBookingStatusRoute,
  updateBookingStatusRouteHandler,
} from "./update-booking-status.js";
import {
  getBookingCalendarRoute,
  getBookingCalendarRouteHandler,
} from "./get-booking-calendar.js";
import {
  getMyBookingRequestRoute,
  getMyBookingRequestRouteHandler,
  getAdminBookingRequestRoute,
  getAdminBookingRequestRouteHandler,
} from "./get-booking-request.js";
const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json(
        {
          error: result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
  },
});
const customer = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer")
    return c.json({ error: "Customer access required" }, 403);
  await next();
});
routes.use("/booking-requests", requireSession, customer);
routes.use("/booking-requests/*", requireSession, customer);
routes.use("/admin/booking-requests", requireSession, requireSystemAdmin);
routes.use("/admin/booking-requests/*", requireSession, requireSystemAdmin);
routes.openapi(saveRequestedDayTimesRoute, saveRequestedDayTimesRouteHandler);
routes.openapi(createBookingRequestRoute, createBookingRequestRouteHandler);
routes.openapi(cancelBookingRequestRoute, cancelBookingRequestRouteHandler);
routes.openapi(listMyBookingRequestsRoute, listMyBookingRequestsRouteHandler);
routes.openapi(
  listAdminBookingRequestsRoute,
  listAdminBookingRequestsRouteHandler,
);
routes.openapi(getBookingCalendarRoute, getBookingCalendarRouteHandler);
routes.openapi(getMyStatusHistoryRoute, getMyStatusHistoryRouteHandler);
routes.openapi(getAdminStatusHistoryRoute, getAdminStatusHistoryRouteHandler);
routes.openapi(getMyBookingRequestRoute, getMyBookingRequestRouteHandler);
routes.openapi(getAdminBookingRequestRoute, getAdminBookingRequestRouteHandler);
routes.openapi(updateBookingStatusRoute, updateBookingStatusRouteHandler);
routes.openapi(getMyBookingPackageRoute, getMyBookingPackageRouteHandler);
routes.openapi(getAdminBookingPackageRoute, getAdminBookingPackageRouteHandler);
routes.openapi(
  getAdminBookingPackageHistoryRoute,
  getAdminBookingPackageHistoryRouteHandler,
);
routes.openapi(
  createBookingCustomPackageRoute,
  createBookingCustomPackageRouteHandler,
);
routes.openapi(
  updateBookingCustomPackageRoute,
  updateBookingCustomPackageRouteHandler,
);
routes.route("/", quotationRoutes);
export default routes;
