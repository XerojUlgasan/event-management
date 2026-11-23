import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  listNotificationsRoute,
  listNotificationsRouteHandler,
} from "./list-notifications.js";
import {
  markNotificationReadRoute,
  markNotificationReadRouteHandler,
} from "./mark-notification-read.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json({ error: "Invalid notification request" }, 400);
  },
});

routes.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status);

  console.error("notifications", { outcome: "failed" });

  return c.json({ error: "Unable to complete notification request" }, 500);
});

routes.use("/notifications", requireSession);
routes.use("/notifications/*", requireSession);

routes.openapi(listNotificationsRoute, listNotificationsRouteHandler);
routes.openapi(markNotificationReadRoute, markNotificationReadRouteHandler);

export default routes;
