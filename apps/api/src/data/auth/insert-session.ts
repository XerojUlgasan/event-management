import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function insertSessionData(
  db: Database,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  await db
    .deleteFrom("sessions")
    .where("user_id", "=", userId)
    .where("expires_at", "<=", new Date())
    .execute();
  await db
    .insertInto("sessions")
    .values({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
    .execute();
}
