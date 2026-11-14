import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function createFirebaseUserData(
  db: Database,
  uid: string,
  email: string,
  displayName: string,
) {
  return db
    .insertInto("users")
    .values({
      firebase_uid: uid,
      email,
      display_name: displayName,
      role: "customer",
    })
    .onConflict((conflict) => conflict.doNothing())
    .returningAll()
    .executeTakeFirst();
}
