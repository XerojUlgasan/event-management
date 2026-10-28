import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { getCustomerConversationRoute, getCustomerConversationRouteHandler } from "./get-customer-conversation.js";
import { sendCustomerMessageRoute, sendCustomerMessageRouteHandler } from "./send-customer-message.js";
import { listAdminConversationsRoute, listAdminConversationsRouteHandler } from "./list-admin-conversations.js";
import { getAdminConversationRoute, getAdminConversationRouteHandler } from "./get-admin-conversation.js";
import { sendAdminMessageRoute, sendAdminMessageRouteHandler } from "./send-admin-message.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, 400);
  },
});
const customerOnly = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer") return c.json({ error: "Customer access required" }, 403);
  await next();
});
const adminOnly = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "admin") return c.json({ error: "Admin access required" }, 403);
  await next();
});
routes.use("/messages", requireSession, customerOnly);
routes.use("/messages/*", requireSession, customerOnly);
routes.use("/admin/conversations", requireSession, adminOnly);
routes.use("/admin/conversations/*", requireSession, adminOnly);

routes.openapi(getCustomerConversationRoute, getCustomerConversationRouteHandler);
routes.openapi(sendCustomerMessageRoute, sendCustomerMessageRouteHandler);
routes.openapi(listAdminConversationsRoute, listAdminConversationsRouteHandler);
routes.openapi(getAdminConversationRoute, getAdminConversationRouteHandler);
routes.openapi(sendAdminMessageRoute, sendAdminMessageRouteHandler);
export default routes;
