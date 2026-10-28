import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { columns } from "../../utils/packages/package-columns.js";

type Database = Kysely<DB> | Transaction<DB>;

export function createPackageDraftData(db: Transaction<DB>, packageId: string, version: number, content: Content, updatedAt?: Date) {
  return db.insertInto("package_versions").values({ package_id: packageId, version, state: "draft",
    ...(updatedAt ? { updated_at: updatedAt } : {}), ...columns(content) }).execute();
}
