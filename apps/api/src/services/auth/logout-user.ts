import { getCookie } from "hono/cookie";
import type { Context } from "hono";

import {
  clearSessionCookie,
  hashSessionToken,
  SESSION_COOKIE,
} from "../../utils/session.js";
import type { HonoEnv } from "../../types/hono.js";
import { deleteSessionByTokenHashData } from "../../data/auth/delete-session-by-token-hash.js";

type AuthContext = Context<HonoEnv>;

export async function logoutUserService(c: AuthContext) {
  const token = getCookie(c, SESSION_COOKIE);

  if (token)
    await deleteSessionByTokenHashData(c.get("db"), hashSessionToken(token));

  clearSessionCookie(c);
}
