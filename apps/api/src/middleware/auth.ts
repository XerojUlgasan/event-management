import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "../types/hono.js";
import { getFirebaseAuth } from "../utils/firebase-admin.js";
import {
  clearSessionCookie,
  SESSION_COOKIE,
} from "../utils/session.js";
import { resolveSessionService } from "../services/auth/resolve-session.js";

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
    const decoded = await auth.verifyIdToken(token, true);
    c.set("firebase", {
      uid: decoded.uid,
      email: decoded.email ?? "",
      name: decoded.name ?? null,
      emailVerified: decoded.email_verified === true,
      authTime: decoded.auth_time,
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

  const result = await resolveSessionService(c.get("db"), token);
  if (result.kind === "not-found") {
    clearSessionCookie(c);
    return c.json({ error: "Session not found" }, 401);
  }

  if (result.kind === "expired") {
    clearSessionCookie(c);
    return c.json({ error: "Session expired" }, 401);
  }

  if (result.kind === "user-not-found") {
    clearSessionCookie(c);
    return c.json({ error: "Session user not found" }, 401);
  }

  c.set("session", result.session);

  await next();
});

// A staff title grants booking visibility only. Administrative privileges require
// the explicit System Administrator designation stored on the current user.
export const requireSystemAdmin = createMiddleware<HonoEnv>(async (c, next) => {
  const user = c.get("session").user;
  if (user.role !== "admin" || user.staff_role !== "System Administrator")
    return c.json({ error: "Admin access required" }, 403);
  await next();
});

// Staff members and admins can access staff-facing routes.
export const requireStaffOrAdmin = createMiddleware<HonoEnv>(async (c, next) => {
  const role = c.get("session").user.role;
  if (!["admin", "staff"].includes(role))
    return c.json({ error: "Staff access required" }, 403);
  await next();
});
