import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function deletePackageData(db: Transaction<DB>, id: string) {
  return db.deleteFrom("packages").where("id", "=", id).execute();
}
