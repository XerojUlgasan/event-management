import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";

export const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "Get the signed-in user's profile",
  responses: {
    200: {
      content: { "application/json": { schema: profileSchema } },
      description: "The user's profile",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "Missing or invalid token",
    },
    404: {
      content: { "application/json": { schema: errorSchema } },
      description: "No profile exists for the signed-in user",
    },
    503: {
      content: { "application/json": { schema: errorSchema } },
      description: "Firebase Admin is not configured",
    },
  },
});

export const getMeHandler: AppRouteHandler<typeof getMeRoute> = async (c) => {
  const row = await c
    .get("db")
    .selectFrom("users")
    .selectAll()
    .where("firebase_uid", "=", c.get("auth").uid)
    .executeTakeFirst();

  if (!row) {
    return c.json({ error: "Profile not found" }, 404);
  }

  return c.json(toProfile(row), 200);
};
