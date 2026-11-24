import { createHash } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { config } from "../env.js";
import type { HonoEnv } from "../types/hono.js";

export const SESSION_COOKIE = "em_session";

const sessionTtlDays = Number(config.SESSION_TTL_DAYS);

if (!Number.isFinite(sessionTtlDays) || sessionTtlDays <= 0)
  throw new Error("SESSION_TTL_DAYS must be a positive number");

export const SESSION_TTL_MS = sessionTtlDays * 24 * 60 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
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
