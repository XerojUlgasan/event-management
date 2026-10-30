import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { getCustomerConversationRoute, getCustomerConversationRouteHandler } from "./get-customer-conversation.js";
import { sendCustomerMessageRoute, sendCustomerMessageRouteHandler } from "./send-customer-message.js";
import { listAdminConversationsRoute, listAdminConversationsRouteHandler } from "./list-admin-conversations.js";
import { getAdminConversationRoute, getAdminConversationRouteHandler } from "./get-admin-conversation.js";
import { sendAdminMessageRoute, sendAdminMessageRouteHandler } from "./send-admin-message.js";
import { claimConversationRoute, claimConversationRouteHandler } from "./claim-conversation.js";
import { updateConversationContextRoute, updateConversationContextRouteHandler } from "./update-conversation-context.js";
import { requestStaffRoute, requestStaffRouteHandler } from "./request-staff.js";
import { assistantReplyRoute, assistantReplyRouteHandler } from "./assistant-reply.js";
import { takeoverConversationRoute, takeoverConversationRouteHandler } from "./takeover-conversation.js";
import { returnToAiRoute, returnToAiRouteHandler } from "./return-to-ai.js";
import { createCustomerConversationRoute, createCustomerConversationRouteHandler } from "./create-customer-conversation.js";
import { listCustomerConversationsRoute, listCustomerConversationsRouteHandler } from "./list-customer-conversations.js";
import { getCustomerConversationByIdRoute, getCustomerConversationByIdRouteHandler } from "./get-customer-conversation-by-id.js";

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
routes.openapi(createCustomerConversationRoute, createCustomerConversationRouteHandler);
routes.openapi(listCustomerConversationsRoute, listCustomerConversationsRouteHandler);
routes.openapi(getCustomerConversationByIdRoute, getCustomerConversationByIdRouteHandler);
routes.openapi(sendCustomerMessageRoute, sendCustomerMessageRouteHandler);
routes.openapi(claimConversationRoute, claimConversationRouteHandler);
routes.openapi(updateConversationContextRoute, updateConversationContextRouteHandler);
routes.openapi(requestStaffRoute, requestStaffRouteHandler);
routes.openapi(assistantReplyRoute, assistantReplyRouteHandler);
routes.openapi(listAdminConversationsRoute, listAdminConversationsRouteHandler);
routes.openapi(getAdminConversationRoute, getAdminConversationRouteHandler);
routes.openapi(sendAdminMessageRoute, sendAdminMessageRouteHandler);
routes.openapi(takeoverConversationRoute, takeoverConversationRouteHandler);
routes.openapi(returnToAiRoute, returnToAiRouteHandler);
export default routes;
