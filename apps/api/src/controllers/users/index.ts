import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { listAdminUsersRoute, listAdminUsersRouteHandler } from "./list-admin-users.js";

const routes = new OpenAPIHono<HonoEnv>();

const admin = requireSystemAdmin;

routes.use("/admin/users", requireSession, admin);
routes.openapi(listAdminUsersRoute, listAdminUsersRouteHandler);

export default routes;
