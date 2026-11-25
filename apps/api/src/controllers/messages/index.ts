import {
  retryCustomerMessageRoute,
  retryCustomerMessageRouteHandler,
  retryAdminMessageRoute,
  retryAdminMessageRouteHandler,
} from "./retry-message-processing.js";
import { HTTPException } from "hono/http-exception";
import { OpenAPIHono } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { createMiddleware } from "hono/factory";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  updateConversationAiRoute,
  updateConversationAiRouteHandler,
} from "./update-conversation-ai.js";
import {
  getCustomerConversationRoute,
  getCustomerConversationRouteHandler,
} from "./get-customer-conversation.js";
import {
  sendCustomerMessageRoute,
  sendCustomerMessageRouteHandler,
} from "./send-customer-message.js";
import {
  listAdminConversationsRoute,
  listAdminConversationsRouteHandler,
} from "./list-admin-conversations.js";
import {
  getAdminConversationRoute,
  getAdminConversationRouteHandler,
} from "./get-admin-conversation.js";
import {
  getAdminConversationMemoryRoute,
  getAdminConversationMemoryRouteHandler,
} from "./get-admin-conversation-memory.js";
import {
  sendAdminMessageRoute,
  sendAdminMessageRouteHandler,
} from "./send-admin-message.js";
import {
  createCustomerConversationRoute,
  createCustomerConversationRouteHandler,
} from "./create-customer-conversation.js";
import {
  listCustomerConversationsRoute,
  listCustomerConversationsRouteHandler,
} from "./list-customer-conversations.js";
import {
  getCustomerConversationByIdRoute,
  getCustomerConversationByIdRouteHandler,
} from "./get-customer-conversation-by-id.js";
import {
  markAdminConversationReadRoute,
  markAdminConversationReadRouteHandler,
  markCustomerConversationReadRoute,
  markCustomerConversationReadRouteHandler,
} from "./mark-conversation-read.js";

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

routes.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status);

  console.error("messages", { outcome: "failed" });

  return c.json({ error: "Unable to complete message request" }, 500);
});

const customerOnly = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer")
    return jsonError(c, "Customer access required", 403);

  await next();
});

const adminOnly = requireSystemAdmin;

routes.use("/messages", requireSession, customerOnly);
routes.use("/messages/*", requireSession, customerOnly);
routes.use("/admin/conversations", requireSession, adminOnly);
routes.use("/admin/conversations/*", requireSession, adminOnly);

routes.openapi(
  getCustomerConversationRoute,
  getCustomerConversationRouteHandler,
);
routes.openapi(
  createCustomerConversationRoute,
  createCustomerConversationRouteHandler,
);
routes.openapi(
  listCustomerConversationsRoute,
  listCustomerConversationsRouteHandler,
);
routes.openapi(
  getCustomerConversationByIdRoute,
  getCustomerConversationByIdRouteHandler,
);
routes.openapi(sendCustomerMessageRoute, sendCustomerMessageRouteHandler);
routes.openapi(listAdminConversationsRoute, listAdminConversationsRouteHandler);
routes.openapi(getAdminConversationRoute, getAdminConversationRouteHandler);
routes.openapi(
  getAdminConversationMemoryRoute,
  getAdminConversationMemoryRouteHandler,
);
routes.openapi(sendAdminMessageRoute, sendAdminMessageRouteHandler);
routes.openapi(updateConversationAiRoute, updateConversationAiRouteHandler);

routes.openapi(retryCustomerMessageRoute, retryCustomerMessageRouteHandler);
routes.openapi(retryAdminMessageRoute, retryAdminMessageRouteHandler);
routes.openapi(
  markCustomerConversationReadRoute,
  markCustomerConversationReadRouteHandler,
);
routes.openapi(
  markAdminConversationReadRoute,
  markAdminConversationReadRouteHandler,
);

export default routes;
