import type { Context } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { allowAuthAttempt } from "../../utils/auth-limit.js";
import { hashPassword } from "../../utils/password.js";

import type { FirebaseUser, HonoEnv, SessionContext } from "../../types/hono.js";
import { addLocalPasswordData } from "../../data/auth/add-local-password.js";

import { recentlyAuthenticated } from "../../utils/auth/recently-authenticated.js";

type AuthContext = Context<HonoEnv>;

export async function addPasswordService(db: Kysely<DB>, session: SessionContext, firebase: FirebaseUser, password: string) {
  const user = session.user;
  if (!allowAuthAttempt(user.id)) return { kind: "rate-limited" as const };
  if (firebase.uid !== user.firebase_uid || !firebase.emailVerified ||
    firebase.email.trim().toLowerCase() !== user.email.trim().toLowerCase() || !recentlyAuthenticated(firebase))
    return { kind: "invalid" as const };
  const row = await addLocalPasswordData(db, user.id, await hashPassword(password));
  return row ? { kind: "ok" as const, row } : { kind: "conflict" as const };
}
