import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function createPackageData(db: Transaction<DB>, id: string) {
  return db.insertInto("packages").values({ id }).returningAll().executeTakeFirstOrThrow();
}
