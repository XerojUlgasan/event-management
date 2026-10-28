import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function listPackageVersionImageUrlsData(db: Transaction<DB>, packageId: string) {
  return db.selectFrom("package_versions").select("image_url").where("package_id", "=", packageId).execute();
}
