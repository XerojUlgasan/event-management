import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function addLocalPasswordData(
  db: Database,
  userId: string,
  passwordHash: string,
) {
  return db
    .updateTable("users")
    .set({ password_hash: passwordHash, updated_at: new Date() })
    .where("id", "=", userId)
    .where("password_hash", "is", null)
    .returningAll()
    .executeTakeFirst();
}
