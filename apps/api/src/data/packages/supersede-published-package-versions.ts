import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function supersedePublishedPackageVersionsData(db: Transaction<DB>, packageId: string) {
  return db.updateTable("package_versions").set({ state: "superseded" }).where("package_id", "=", packageId).where("state", "=", "published").execute();
}
