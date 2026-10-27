import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { startSession } from "../../lib/session.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";

export const syncProfileRoute = createRoute({
  method: "post",
  path: "/auth/sync",
  tags: ["Auth"],
  summary:
    "Verify a Firebase identity and start a session without merging accounts by email",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            displayName: z.string().trim().min(1).max(120).optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: profileSchema } },
      description: "Profile and session cookie",
    },
    400: {
      content: { "application/json": { schema: errorSchema } },
      description: "Missing email",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "Invalid Firebase identity",
    },
    409: {
      content: { "application/json": { schema: errorSchema } },
      description: "Email belongs to another account",
    },
    503: {
      content: { "application/json": { schema: errorSchema } },
      description: "Firebase is not configured",
    },
  },
});

export const syncProfileHandler: AppRouteHandler<
  typeof syncProfileRoute
> = async (c) => {
  const firebase = c.get("firebase");
  if (!firebase.email) {
    return c.json(
      { error: "The signed-in account does not have an email address" },
      400,
    );
  }

  const db = c.get("db");
  let row = await db
    .selectFrom("users")
    .selectAll()
    .where("firebase_uid", "=", firebase.uid)
    .executeTakeFirst();
  if (!row) {
    const { displayName } = c.req.valid("json");
    row = await db
      .insertInto("users")
      .values({
        firebase_uid: firebase.uid,
        email: firebase.email.trim().toLowerCase(),
        display_name:
          displayName ?? firebase.name ?? firebase.email.split("@")[0],
        role: "customer",
      })
      .onConflict((conflict) => conflict.doNothing())
      .returningAll()
      .executeTakeFirst();
    // A simultaneous login may already have created this Firebase account.
    row ??= await db
      .selectFrom("users")
      .selectAll()
      .where("firebase_uid", "=", firebase.uid)
      .executeTakeFirst();
  }
  if (!row) {
    return c.json(
      {
        error:
          "An account already uses this email. Sign in with its existing method, then connect Firebase in Sign-in methods.",
      },
      409,
    );
  }

  // The app profile and role belong to our database, including after linking.
  await startSession(c, row.id);
  return c.json(toProfile(row), 200);
};
