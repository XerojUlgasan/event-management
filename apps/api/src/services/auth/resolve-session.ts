import type { Context } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { hashSessionToken } from "../../utils/session.js";
import type { HonoEnv } from "../../types/hono.js";
import { deleteSessionByIdData } from "../../data/auth/delete-session-by-id.js";
import { findSessionByTokenHashData } from "../../data/auth/find-session-by-token-hash.js";
import { findUserByIdData } from "../../data/auth/find-user-by-id.js";

type AuthContext = Context<HonoEnv>;

export async function resolveSessionService(db: Kysely<DB>, token: string) {
  const session = await findSessionByTokenHashData(db, hashSessionToken(token));

  if (!session) return { kind: "not-found" as const };

  if (session.expires_at.getTime() <= Date.now()) {
    await deleteSessionByIdData(db, session.id);

    return { kind: "expired" as const };
  }

  const user = await findUserByIdData(db, session.user_id);

  if (!user) {
    await deleteSessionByIdData(db, session.id);

    return { kind: "user-not-found" as const };
  }

  return {
    kind: "ok" as const,
    session: { sessionId: session.id, expiresAt: session.expires_at, user },
  };
}
