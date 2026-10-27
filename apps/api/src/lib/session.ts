import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { Kysely } from "kysely";
import type { DB } from "../db/types.js";
import type { HonoEnv } from "../types/hono.js";

export const SESSION_COOKIE = "em_session";

const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? 7);
export const SESSION_TTL_MS =
  (Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 7) * 24 * 60 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: Kysely<DB>, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db
    .deleteFrom("sessions")
    .where("user_id", "=", userId)
    .where("expires_at", "<=", new Date())
    .execute();

  await db
    .insertInto("sessions")
    .values({
      user_id: userId,
      token_hash: hashSessionToken(token),
      expires_at: expiresAt,
    })
    .execute();

  return { token, expiresAt };
}

export function setSessionCookie(
  c: Context<HonoEnv>,
  token: string,
  expiresAt: Date,
) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

export function clearSessionCookie(c: Context<HonoEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
