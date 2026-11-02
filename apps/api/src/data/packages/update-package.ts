import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { packageColumns } from "./create-package.js";
export function updatePackageData(
  db: Transaction<DB>,
  id: string,
  content: Content,
  now: Date,
) {
  return db
    .updateTable("packages")
    .set({ ...packageColumns(content), updated_at: now })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}
