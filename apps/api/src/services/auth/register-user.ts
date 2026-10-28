import type { Context } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { allowAuthAttempt } from "../../utils/auth-limit.js";
import { hashPassword } from "../../utils/password.js";

import type { HonoEnv } from "../../types/hono.js";
import { createLocalUserData } from "../../data/auth/create-local-user.js";

type AuthContext = Context<HonoEnv>;

export async function registerUserService(db: Kysely<DB>, email: string, password: string, displayName: string) {
  if (!allowAuthAttempt(email)) return { kind: "rate-limited" as const };
  const row = await createLocalUserData(db, email, displayName, await hashPassword(password));
  return row ? { kind: "ok" as const, row } : { kind: "conflict" as const };
}
