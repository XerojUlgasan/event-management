import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const findAvailablePackageData = (
  db: Transaction<DB>,
  packageId: string,
) =>
  db
    .selectFrom("packages")
    .selectAll()
    .where("id", "=", packageId)
    .where("package_type", "=", "catalog")
    .where("archived_at", "is", null)
    .forUpdate()
    .executeTakeFirst();
