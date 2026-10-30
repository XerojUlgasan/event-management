import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../../types/hono.js";
import { guestReplyRoute, guestReplyRouteHandler } from "./guest-reply.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, 400);
  },
});

routes.openapi(guestReplyRoute, guestReplyRouteHandler);
export default routes;
