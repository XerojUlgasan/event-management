import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  createCustomizationRequestRoute,
  createCustomizationRequestRouteHandler,
  createCustomerCustomizationRequestRoute,
  createCustomerCustomizationRequestRouteHandler,
} from "./create-customization-request.js";
import {
  withdrawCustomizationRequestRoute,
  withdrawCustomizationRequestRouteHandler,
} from "./withdraw-customization-request.js";
import {
  listAdminCustomizationRequestsRoute,
  listAdminCustomizationRequestsRouteHandler,
} from "./list-admin-customization-requests.js";
import {
  decideCustomizationRequestRoute,
  decideCustomizationRequestRouteHandler,
} from "./decide-customization-request.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json(
        {
          error: result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
        400,
      );
  },
});

const bookingReader = createMiddleware<HonoEnv>(async (c, next) => {
  if (!["admin", "staff"].includes(c.get("session").user.role))
    return c.json({ error: "Staff access required" }, 403);
  await next();
});

// Administrators record customization discussed in chat; staff can read the queue.
routes.use("/admin/booking-requests/*", requireSession, createMiddleware<HonoEnv>(async (c, next) => {
  if (
    c.req.method === "POST" &&
    c.req.path.endsWith("/customization-requests") &&
    c.get("session").user.role === "customer"
  ) {
    await next();
    return;
  }
  return requireSystemAdmin(c, next);
}));
routes.use("/booking-requests/*", requireSession, createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer")
    return c.json({ error: "Customer access required" }, 403);
  await next();
}));
routes.use("/customization-requests/*", requireSession, createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer")
    return c.json({ error: "Customer access required" }, 403);
  await next();
}));
routes.use("/admin/customization-requests", requireSession, bookingReader);
routes.use(
  "/admin/customization-requests/*",
  requireSession,
  createMiddleware<HonoEnv>(async (c, next) => {
    if (c.req.method === "GET") return bookingReader(c, next);
    return requireSystemAdmin(c, next);
  }),
);

routes.openapi(
  createCustomizationRequestRoute,
  createCustomizationRequestRouteHandler,
);
routes.openapi(
  createCustomerCustomizationRequestRoute,
  createCustomerCustomizationRequestRouteHandler,
);
routes.openapi(
  withdrawCustomizationRequestRoute,
  withdrawCustomizationRequestRouteHandler,
);
routes.openapi(
  listAdminCustomizationRequestsRoute,
  listAdminCustomizationRequestsRouteHandler,
);
routes.openapi(
  decideCustomizationRequestRoute,
  decideCustomizationRequestRouteHandler,
);

export default routes;
