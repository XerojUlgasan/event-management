import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findCurrentPackageVersionData(db: Transaction<DB>, packageId: string) {
  return db.selectFrom("package_versions").selectAll().where("package_id", "=", packageId)
    .where("state", "in", ["draft", "published"]).orderBy("version", "desc").executeTakeFirst();
}
