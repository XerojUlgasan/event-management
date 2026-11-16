import { randomBytes } from "node:crypto";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import type { HonoEnv } from "../types/hono.js";
import { env } from "./env.js";

export const GUEST_COOKIE = "em_guest";
export function createGuestToken() {
  return randomBytes(32).toString("base64url");
}
export function setGuestCookie(c: Context<HonoEnv>, token: string) {
  setCookie(c, GUEST_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    // Browser identity survives a conversation's inactivity timeout.
    maxAge: 30 * 24 * 60 * 60,
  });
}
