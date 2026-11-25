import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { config } from "../env.js";
import type { HonoEnv } from "../types/hono.js";

export const SESSION_COOKIE = "em_session";

const { SESSION_TTL_DAYS = "7" } = config;

const sessionDays = Number(SESSION_TTL_DAYS);

export const SESSION_TTL_MS =
  (Number.isFinite(sessionDays) && sessionDays > 0 ? sessionDays : 7) *
  24 *
  60 *
  60 *
  1000;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionCredentials() {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  return { token, tokenHash: hashSessionToken(token), expiresAt };
}

export function setSessionCookie(
  c: Context<HonoEnv>,
  token: string,
  expiresAt: Date,
) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

export function clearSessionCookie(c: Context<HonoEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
