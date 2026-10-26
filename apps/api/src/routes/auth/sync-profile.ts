import { createRoute, z } from "@hono/zod-openapi";
import { sql } from "kysely";
import type { AppRouteHandler } from "../../types/hono.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";

const syncBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const syncProfileRoute = createRoute({
  method: "post",
  path: "/auth/sync",
  tags: ["Auth"],
  summary: "Create or refresh the signed-in user's profile",
  request: {
    body: {
      content: { "application/json": { schema: syncBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: profileSchema } },
      description: "The user's profile",
    },
    400: {
      content: { "application/json": { schema: errorSchema } },
      description: "The account has no email address",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "Missing or invalid token",
    },
    503: {
      content: { "application/json": { schema: errorSchema } },
      description: "Firebase Admin is not configured",
    },
  },
});

export const syncProfileHandler: AppRouteHandler<typeof syncProfileRoute> = async (c) => {
  const auth = c.get("auth");

  if (!auth.email) {
    return c.json({ error: "The signed-in account does not have an email address" }, 400);
  }

  const { displayName } = c.req.valid("json");
  const resolvedName = displayName ?? auth.name ?? auth.email.split("@")[0] ?? "Customer";

  const row = await c
    .get("db")
    .insertInto("users")
    .values({
      firebase_uid: auth.uid,
      email: auth.email,
      display_name: resolvedName,
      role: "customer",
    })
    .onConflict((conflict) =>
      conflict.column("firebase_uid").doUpdateSet({
        email: auth.email,
        display_name: sql`coalesce(excluded.display_name, users.display_name)`,
        updated_at: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  return c.json(toProfile(row), 200);
};
