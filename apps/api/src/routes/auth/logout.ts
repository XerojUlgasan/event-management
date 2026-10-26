import { createRoute } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  clearSessionCookie,
  hashSessionToken,
  SESSION_COOKIE,
} from "../../lib/session.js";

export const logoutRoute = createRoute({
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

export const logoutHandler: AppRouteHandler<typeof logoutRoute> = async (c) => {
  const token = getCookie(c, SESSION_COOKIE);

  if (token) {
    await c
      .get("db")
      .deleteFrom("sessions")
      .where("token_hash", "=", hashSessionToken(token))
      .execute();
  }

  clearSessionCookie(c);

  return c.body(null, 204);
};
