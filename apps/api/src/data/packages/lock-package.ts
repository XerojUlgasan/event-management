import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function lockPackageData(db: Transaction<DB>, id: string) {
  return db.selectFrom("packages").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
}
