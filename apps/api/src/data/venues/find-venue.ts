import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findVenueData(db: Database, id: string) {
  return db.selectFrom("venues").selectAll().where("id", "=", id).executeTakeFirst();
}
