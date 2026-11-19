import {
  retryGuestMessageRoute,
  retryGuestMessageRouteHandler,
} from "../messages/retry-message-processing.js";
import { OpenAPIHono } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { HTTPException } from "hono/http-exception";
import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "../../types/hono.js";
import { requireSession } from "../../middleware/auth.js";
import { GuestChatError } from "../../data/guest-chat/guest-conversation.js";
import {
  bootstrapGuestConversationRoute,
  bootstrapGuestConversationRouteHandler,
} from "./bootstrap-conversation.js";
import {
  getGuestConversationRoute,
  getGuestConversationRouteHandler,
} from "./get-conversation.js";
import {
  sendGuestMessageRoute,
  sendGuestMessageRouteHandler,
} from "./send-message.js";
import {
  claimGuestConversationRoute,
  claimGuestConversationRouteHandler,
} from "./claim-conversation.js";

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
  if (error instanceof GuestChatError)
    return c.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      error.status,
    );

  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status);

  console.error("guest-chat", { outcome: "failed" });

  return jsonError(c, "Unable to complete guest chat request", 500);
});

const customerOnly = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer")
    return jsonError(c, "Customer access required", 403);

  await next();
});

routes.use("/guest/conversations/:id/claim", requireSession, customerOnly);

routes.openapi(
  bootstrapGuestConversationRoute,
  bootstrapGuestConversationRouteHandler,
);
routes.openapi(getGuestConversationRoute, getGuestConversationRouteHandler);
routes.openapi(sendGuestMessageRoute, sendGuestMessageRouteHandler);
routes.openapi(claimGuestConversationRoute, claimGuestConversationRouteHandler);

routes.openapi(retryGuestMessageRoute, retryGuestMessageRouteHandler);

export default routes;
