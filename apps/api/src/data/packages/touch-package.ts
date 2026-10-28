import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function touchPackageData(db: Transaction<DB>, id: string, updatedAt: Date) {
  return db.updateTable("packages").set({ updated_at: updatedAt }).where("id", "=", id).execute();
}
