import type { Insertable, Kysely, Transaction } from "kysely";
import type { DB, ShowcaseRecords } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export const createShowcaseRecordData = (
  db: Database,
  values: Insertable<ShowcaseRecords>,
) =>
  db
    .insertInto("showcase_records")
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
