import type { Context } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { allowAuthAttempt } from "../../utils/auth-limit.js";
import { verifyPassword } from "../../utils/password.js";

import type { HonoEnv } from "../../types/hono.js";
import { findUserByEmailData } from "../../data/auth/find-user-by-email.js";

type AuthContext = Context<HonoEnv>;

export async function loginUserService(
  db: Kysely<DB>,
  email: string,
  password: string,
) {
  if (!allowAuthAttempt(email)) return { kind: "rate-limited" as const };

  const row = await findUserByEmailData(db, email);
  const valid = await verifyPassword(row?.password_hash ?? null, password);

  return row && valid
    ? { kind: "ok" as const, row }
    : { kind: "invalid" as const };
}
