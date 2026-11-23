import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const publishShowcaseRecordData = (db: Database, id: string, now: Date) =>
  db
    .updateTable("showcase_records")
    .set({ published_at: now, updated_at: now })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
