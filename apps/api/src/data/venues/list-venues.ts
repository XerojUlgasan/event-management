import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function listVenuesData(db: Database) {
  return db.selectFrom("venues").selectAll().where("archived_at", "is", null).orderBy("name", "asc").execute();
}
