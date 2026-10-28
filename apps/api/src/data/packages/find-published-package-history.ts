import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findPublishedPackageHistoryData(db: Transaction<DB>, packageId: string) {
  return db.selectFrom("package_versions").select("id").where("package_id", "=", packageId).where("published_at", "is not", null).executeTakeFirst();
}
