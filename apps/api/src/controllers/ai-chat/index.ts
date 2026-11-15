import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { aiChatRoute, aiChatRouteHandler } from "./chat.js";
import { publicAiChatRoute, publicAiChatRouteHandler } from "./public-chat.js";
import {
  claimGuestChatRoute,
  claimGuestChatRouteHandler,
} from "./claim-chat.js";

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

const customerOnly = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer")
    return c.json({ error: "Customer access required" }, 403);
  await next();
});

// Authenticated routes — require a customer session.
routes.use("/ai-chat/message", requireSession, customerOnly);
routes.use("/ai-chat/claim", requireSession, customerOnly);
routes.openapi(aiChatRoute, aiChatRouteHandler);
routes.openapi(claimGuestChatRoute, claimGuestChatRouteHandler);

// Public route — no auth required.
routes.openapi(publicAiChatRoute, publicAiChatRouteHandler);

export default routes;
