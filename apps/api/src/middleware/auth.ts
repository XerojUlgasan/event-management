import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "../types/hono.js";
import { getFirebaseAuth } from "../lib/firebase-admin.js";
import {
  clearSessionCookie,
  hashSessionToken,
  SESSION_COOKIE,
} from "../lib/session.js";

export const requireFirebaseAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const token = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return c.json({ error: "Missing Firebase ID token" }, 401);
  }

  let auth;
  try {
    auth = getFirebaseAuth();
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Firebase Admin is not configured" },
      503,
    );
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    c.set("firebase", {
      uid: decoded.uid,
      email: decoded.email ?? "",
      name: decoded.name ?? null,
    });
  } catch {
    return c.json({ error: "Invalid or expired Firebase ID token" }, 401);
  }

  await next();
});

export const requireSession = createMiddleware<HonoEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);

  if (!token) {
    return c.json({ error: "Not signed in" }, 401);
  }

  const db = c.get("db");
  const session = await db
    .selectFrom("sessions")
    .selectAll()
    .where("token_hash", "=", hashSessionToken(token))
    .executeTakeFirst();

  if (!session) {
    clearSessionCookie(c);
    return c.json({ error: "Session not found" }, 401);
  }

  if (session.expires_at.getTime() <= Date.now()) {
    await db.deleteFrom("sessions").where("id", "=", session.id).execute();
    clearSessionCookie(c);
    return c.json({ error: "Session expired" }, 401);
  }

  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", session.user_id)
    .executeTakeFirst();

  if (!user) {
    await db.deleteFrom("sessions").where("id", "=", session.id).execute();
    clearSessionCookie(c);
    return c.json({ error: "Session user not found" }, 401);
  }

  c.set("session", {
    sessionId: session.id,
    expiresAt: session.expires_at,
    user,
  });

  await next();
});
