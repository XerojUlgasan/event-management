import { randomBytes } from "node:crypto";
import { getCookie } from "hono/cookie";
import type { Context } from "hono";

import { hashSessionToken, SESSION_COOKIE, SESSION_TTL_MS, setSessionCookie } from "../../utils/session.js";
import type { HonoEnv } from "../../types/hono.js";
import { deleteSessionByTokenHashData } from "../../data/auth/delete-session-by-token-hash.js";
import { insertSessionData } from "../../data/auth/insert-session.js";

type AuthContext = Context<HonoEnv>;

export async function startSessionService(c: AuthContext, userId: string) {
  const previousToken = getCookie(c, SESSION_COOKIE);
  const session = await c.get("db").transaction().execute(async (trx) => {
    if (previousToken) await deleteSessionByTokenHashData(trx, hashSessionToken(previousToken));
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await insertSessionData(trx, userId, hashSessionToken(token), expiresAt);
    return { token, expiresAt };
  });
  setSessionCookie(c, session.token, session.expiresAt);
}
