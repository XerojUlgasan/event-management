import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function listPackagesData(db: Database) {
  return db.selectFrom("packages").selectAll().orderBy("created_at", "desc").execute();
}
