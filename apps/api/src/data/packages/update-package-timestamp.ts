import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function updatePackageTimestampData(db: Transaction<DB>, id: string, now: Date) {
  return db.updateTable("packages").set({ updated_at: now }).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
}
