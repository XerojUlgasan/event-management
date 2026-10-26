import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "../types/hono.js";
import { getFirebaseAuth } from "../lib/firebase-admin.js";

export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const token = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return c.json({ error: "Missing bearer token" }, 401);
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
    c.set("auth", {
      uid: decoded.uid,
      email: decoded.email ?? "",
      name: decoded.name ?? null,
    });
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
});
