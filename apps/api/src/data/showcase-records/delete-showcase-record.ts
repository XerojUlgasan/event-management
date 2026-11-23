import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const deleteShowcaseRecordData = (db: Database, id: string) =>
  db.deleteFrom("showcase_records").where("id", "=", id).executeTakeFirst();
