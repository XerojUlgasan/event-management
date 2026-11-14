import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function archivePackageData(
  db: Transaction<DB>,
  id: string,
  archivedAt: Date,
  updatedAt: Date,
) {
  return db
    .updateTable("packages")
    .set({ archived_at: archivedAt, updated_at: updatedAt })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}
