import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { columns } from "../../utils/packages/package-columns.js";

type Database = Kysely<DB> | Transaction<DB>;

export function updatePackageDraftData(db: Transaction<DB>, id: string, content: Content, updatedAt: Date) {
  return db.updateTable("package_versions").set({ ...columns(content), updated_at: updatedAt }).where("id", "=", id).execute();
}
