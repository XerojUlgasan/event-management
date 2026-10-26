import { createRoute, z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import { sql } from "kysely";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  createSession,
  hashSessionToken,
  SESSION_COOKIE,
  setSessionCookie,
} from "../../lib/session.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";

const syncBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const syncProfileRoute = createRoute({
  method: "post",
  path: "/auth/sync",
  tags: ["Auth"],
  summary: "Verify a Firebase ID token, upsert the profile, and start a session",
  request: {
    body: {
      content: { "application/json": { schema: syncBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: profileSchema } },
      description: "The user's profile and a session cookie",
    },
    400: {
      content: { "application/json": { schema: errorSchema } },
      description: "The account has no email address",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "Missing or invalid Firebase ID token",
    },
    503: {
      content: { "application/json": { schema: errorSchema } },
      description: "Firebase Admin is not configured",
    },
  },
});

export const syncProfileHandler: AppRouteHandler<typeof syncProfileRoute> = async (c) => {
  const firebase = c.get("firebase");

  if (!firebase.email) {
    return c.json({ error: "The signed-in account does not have an email address" }, 400);
  }

  const { displayName } = c.req.valid("json");
  const resolvedName =
    displayName ?? firebase.name ?? firebase.email.split("@")[0] ?? "Customer";
  const db = c.get("db");

  const row = await db
    .insertInto("users")
    .values({
      firebase_uid: firebase.uid,
      email: firebase.email,
      display_name: resolvedName,
      role: "customer",
    })
    .onConflict((conflict) =>
      conflict.column("firebase_uid").doUpdateSet({
        email: firebase.email,
        display_name: sql`coalesce(excluded.display_name, users.display_name)`,
        updated_at: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  const previousToken = getCookie(c, SESSION_COOKIE);
  if (previousToken) {
    await db
      .deleteFrom("sessions")
      .where("token_hash", "=", hashSessionToken(previousToken))
      .execute();
  }

  const { token, expiresAt } = await createSession(db, row.id);
  setSessionCookie(c, token, expiresAt);

  return c.json(toProfile(row), 200);
};
