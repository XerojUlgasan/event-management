import { getCookie } from "hono/cookie";
import type { Context } from "hono";

import {
  createSessionCredentials,
  hashSessionToken,
  SESSION_COOKIE,
  setSessionCookie,
} from "../../utils/session.js";
import type { HonoEnv } from "../../types/hono.js";
import { deleteSessionByTokenHashData } from "../../data/auth/delete-session-by-token-hash.js";
import { insertSessionData } from "../../data/auth/insert-session.js";

type AuthContext = Context<HonoEnv>;

export async function startSessionService(c: AuthContext, userId: string) {
  const previousToken = getCookie(c, SESSION_COOKIE);

  const session = await c
    .get("db")
    .transaction()
    .execute(async (trx) => {
      if (previousToken)
        await deleteSessionByTokenHashData(
          trx,
          hashSessionToken(previousToken),
        );

      const { token, tokenHash, expiresAt } = createSessionCredentials();
      await insertSessionData(trx, userId, tokenHash, expiresAt);

      return { token, expiresAt };
    });

  setSessionCookie(c, session.token, session.expiresAt);
}
