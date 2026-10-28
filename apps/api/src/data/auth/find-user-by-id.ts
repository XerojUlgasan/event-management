import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findUserByIdData(db: Database, id: string) {
  return db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
}
