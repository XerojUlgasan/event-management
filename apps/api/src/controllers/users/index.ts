import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { listAdminUsersRoute, listAdminUsersRouteHandler } from "./list-admin-users.js";

const routes = new OpenAPIHono<HonoEnv>();

const admin = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "admin") return c.json({ error: "Admin access required" }, 403);
  await next();
});

routes.use("/admin/users", requireSession, admin);
routes.openapi(listAdminUsersRoute, listAdminUsersRouteHandler);

export default routes;
