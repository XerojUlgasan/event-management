import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";

export const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "Get the profile for the current session",
  responses: {
    200: {
      content: { "application/json": { schema: profileSchema } },
      description: "The user's profile",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "Missing, invalid, or expired session",
    },
  },
});

export const getMeRouteHandler: AppRouteHandler<typeof getMeRoute> = async (c) => {
  return c.json(toProfile(c.get("session").user), 200);
};
