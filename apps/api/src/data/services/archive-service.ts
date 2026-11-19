import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const archiveServiceData = (
  db: Transaction<DB>,
  id: string,
  archivedAt: Date,
  updatedAt: Date,
) =>
  db
    .updateTable("services")
    .set({ archived_at: archivedAt, updated_at: updatedAt })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
