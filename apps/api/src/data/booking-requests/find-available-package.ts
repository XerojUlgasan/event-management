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
    .where("archived_at", "is", null)
    .forUpdate()
    .executeTakeFirst();
