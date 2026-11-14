import type { Context } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { allowAuthAttempt } from "../../utils/auth-limit.js";
import { verifyPassword } from "../../utils/password.js";

import type {
  FirebaseUser,
  HonoEnv,
  SessionContext,
} from "../../types/hono.js";
import { linkFirebaseUidData } from "../../data/auth/link-firebase-uid.js";

import { recentlyAuthenticated } from "../../utils/auth/recently-authenticated.js";

type AuthContext = Context<HonoEnv>;

export async function linkFirebaseService(
  db: Kysely<DB>,
  session: SessionContext,
  firebase: FirebaseUser,
  currentPassword: string,
) {
  const user = session.user;
  if (!allowAuthAttempt(user.id)) return { kind: "rate-limited" as const };
  if (
    !(await verifyPassword(user.password_hash, currentPassword)) ||
    !firebase.emailVerified ||
    !recentlyAuthenticated(firebase)
  )
    return { kind: "invalid" as const };
  const row = await linkFirebaseUidData(db, user.id, firebase.uid);
  return row ? { kind: "ok" as const, row } : { kind: "conflict" as const };
}
