import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { logoutUserService } from "../../services/auth/logout-user.js";

export const logoutUserRoute = createRoute({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "End the current session",
  responses: {
    204: {
      description: "Session ended",
    },
  },
});

export const logoutUserRouteHandler: AppRouteHandler<
  typeof logoutUserRoute
> = async (c) => {
  await logoutUserService(c);

  return c.body(null, 204);
};
