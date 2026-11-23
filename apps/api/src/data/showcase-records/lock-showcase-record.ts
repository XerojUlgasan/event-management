import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

/** SELECT … FOR UPDATE — serialises concurrent saves on the same record. */
export const lockShowcaseRecordData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("showcase_records")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
