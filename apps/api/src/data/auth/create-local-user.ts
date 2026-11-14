import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function createLocalUserData(
  db: Database,
  email: string,
  displayName: string,
  passwordHash: string,
) {
  return db
    .insertInto("users")
    .values({
      email,
      display_name: displayName,
      password_hash: passwordHash,
      role: "customer",
    })
    .onConflict((conflict) => conflict.doNothing())
    .returningAll()
    .executeTakeFirst();
}
