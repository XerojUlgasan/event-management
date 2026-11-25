import type { Kysely } from "kysely";
import { changeLocalPasswordData } from "../../data/auth/change-local-password.js";
import { deleteUsableSessionData } from "../../data/auth/delete-usable-session.js";
import { insertSessionData } from "../../data/auth/insert-session.js";
import type { DB } from "../../db/types.js";
import type { SessionContext } from "../../types/hono.js";
import { allowAuthAttempt } from "../../utils/auth-limit.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { createSessionCredentials } from "../../utils/session.js";

class SessionEnded extends Error {}

export async function changePasswordService(
  db: Kysely<DB>,
  session: SessionContext,
  { currentPassword, password }: { currentPassword: string; password: string },
) {
  const { id: userId, password_hash: currentHash } = session.user;

  if (!allowAuthAttempt(`change-password:${userId}`))
    return { kind: "rate-limited" as const };

  if (currentHash === null) return { kind: "passwordless" as const };

  if (!(await verifyPassword(currentHash, currentPassword)))
    return { kind: "invalid" as const };

  const newHash = await hashPassword(password);

  try {
    return await db.transaction().execute(async (trx) => {
      const row = await changeLocalPasswordData(trx, {
        userId,
        currentHash,
        newHash,
      });

      if (!row) return { kind: "conflict" as const };

      if (!(await deleteUsableSessionData(trx, session.sessionId, userId)))
        throw new SessionEnded();

      const { token, tokenHash, expiresAt } = createSessionCredentials();
      await insertSessionData(trx, userId, tokenHash, expiresAt);

      return { kind: "ok" as const, row, token, expiresAt };
    });
  } catch (error) {
    if (error instanceof SessionEnded)
      return { kind: "session-ended" as const };

    throw error;
  }
}
