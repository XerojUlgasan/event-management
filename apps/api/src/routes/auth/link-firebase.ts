import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { allowAuthAttempt } from "../../lib/auth-limit.js";
import { verifyPassword } from "../../lib/password.js";
import { startSession } from "../../lib/session.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";

export const linkFirebaseRoute = createRoute({
  method: "post",
  path: "/auth/link/firebase",
  tags: ["Auth"],
  summary: "Connect a fresh Firebase identity after proving the local password",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            currentPassword: z.string().min(1).max(128),
          }),
        },
      },
    },
  },
  responses: {
    400: {
      content: { "application/json": { schema: errorSchema } },
      description: "Invalid request",
    },
    200: {
      content: { "application/json": { schema: profileSchema } },
      description: "Firebase connected",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "Proof of both accounts required",
    },
    409: {
      content: { "application/json": { schema: errorSchema } },
      description: "Identity already connected",
    },
    429: {
      content: { "application/json": { schema: errorSchema } },
      description: "Too many attempts",
    },
    503: {
      content: { "application/json": { schema: errorSchema } },
      description: "Firebase is not configured",
    },
  },
});

export const linkFirebaseHandler: AppRouteHandler<
  typeof linkFirebaseRoute
> = async (c) => {
  const { user } = c.get("session");
  const firebase = c.get("firebase");
  if (!allowAuthAttempt(user.id))
    return c.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      429,
    );
  if (
    !(await verifyPassword(
      user.password_hash,
      c.req.valid("json").currentPassword,
    )) ||
    !firebase.emailVerified ||
    !Number.isFinite(firebase.authTime) ||
    Math.abs(Date.now() / 1000 - firebase.authTime) > 300
  ) {
    return c.json(
      {
        error:
          "Enter your current password and sign in again with a verified Firebase account.",
      },
      401,
    );
  }

  const row = await c
    .get("db")
    .transaction()
    .execute(async (db) => {
      await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", user.id)
        .forUpdate()
        .execute();
      const owner = await db
        .selectFrom("users")
        .select("id")
        .where("firebase_uid", "=", firebase.uid)
        .executeTakeFirst();
      if (owner && owner.id !== user.id) return undefined;
      return db
        .updateTable("users")
        .set({ firebase_uid: firebase.uid, updated_at: new Date() })
        .where("id", "=", user.id)
        .where("firebase_uid", "is", null)
        .returningAll()
        .executeTakeFirst();
    })
    .catch((error: unknown) => {
      // The unique Firebase UID also protects against links racing across users.
      if ((error as { code?: string }).code === "23505") return undefined;
      throw error;
    });
  if (!row)
    return c.json(
      {
        error:
          "This Firebase identity or account is already connected. Accounts were not merged.",
      },
      409,
    );
  await startSession(c, row.id);
  return c.json(toProfile(row), 200);
};
