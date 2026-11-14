import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findUserByFirebaseUidData(db: Database, uid: string) {
  return db
    .selectFrom("users")
    .selectAll()
    .where("firebase_uid", "=", uid)
    .executeTakeFirst();
}
