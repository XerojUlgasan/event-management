import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const lockAnyPackageData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("packages")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
