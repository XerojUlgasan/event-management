import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function changeLocalPasswordData(
  db: Transaction<DB>,
  {
    userId,
    currentHash,
    newHash,
  }: { userId: string; currentHash: string; newHash: string },
) {
  return db
    .updateTable("users")
    .set({ password_hash: newHash, updated_at: new Date() })
    .where("id", "=", userId)
    .where("password_hash", "=", currentHash)
    .returningAll()
    .executeTakeFirst();
}
