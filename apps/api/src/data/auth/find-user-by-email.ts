import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findUserByEmailData(db: Database, email: string) {
  return db.selectFrom("users").selectAll().where(sql<string>`lower(trim(email))`, "=", email).executeTakeFirst();
}
