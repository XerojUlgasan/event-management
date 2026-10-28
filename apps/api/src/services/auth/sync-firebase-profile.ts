import type { Context } from "hono";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import type { FirebaseUser, HonoEnv } from "../../types/hono.js";
import { createFirebaseUserData } from "../../data/auth/create-firebase-user.js";
import { findUserByFirebaseUidData } from "../../data/auth/find-user-by-firebase-uid.js";

type AuthContext = Context<HonoEnv>;

export async function syncFirebaseProfileService(db: Kysely<DB>, firebase: FirebaseUser, displayName?: string) {
  if (!firebase.email) return { kind: "missing-email" as const };
  let row = await findUserByFirebaseUidData(db, firebase.uid);
  if (!row) {
    row = await createFirebaseUserData(db, firebase.uid, firebase.email.trim().toLowerCase(),
      displayName ?? firebase.name ?? firebase.email.split("@")[0]);
    // A simultaneous login may already have created this Firebase account.
    row ??= await findUserByFirebaseUidData(db, firebase.uid);
  }
  return row ? { kind: "ok" as const, row } : { kind: "conflict" as const };
}
