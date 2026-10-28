import type { Context } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { hashSessionToken } from "../../utils/session.js";
import type { HonoEnv } from "../../types/hono.js";
import { findAdminSessionByTokenHashData } from "../../data/auth/find-admin-session-by-token-hash.js";

type AuthContext = Context<HonoEnv>;

export async function hasAdminSessionService(db: Kysely<DB>, token: string | undefined) {
  return !!(token && await findAdminSessionByTokenHashData(db, hashSessionToken(token)));
}
