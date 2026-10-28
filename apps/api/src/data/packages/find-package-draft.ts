import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findPackageDraftData(db: Transaction<DB>, packageId: string) {
  return db.selectFrom("package_versions").selectAll().where("package_id", "=", packageId).where("state", "=", "draft").executeTakeFirst();
}
