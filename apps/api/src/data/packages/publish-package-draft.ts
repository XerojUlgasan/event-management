import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function publishPackageDraftData(db: Transaction<DB>, id: string, now: Date) {
  return db.updateTable("package_versions").set({ state: "published", published_at: now, updated_at: now }).where("id", "=", id).execute();
}
