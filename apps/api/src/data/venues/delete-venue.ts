import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export function deleteVenueData(db: Transaction<DB>, id: string) {
  return db.deleteFrom("venues").where("id", "=", id).execute();
}
